import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SyncEvent {
  source: 'realtime' | 'focus' | 'polling' | 'mutation' | 'manual';
  table?: string;
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  timestamp: number;
}

type SyncCallback = (event: SyncEvent) => void;

class RealtimeSyncService {
  private listeners: Set<SyncCallback> = new Set();
  private supabaseChannel: any = null;
  private pollingTimer: any = null;
  private debounceTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private lastSyncTime: number = Date.now();
  private connectionState: 'idle' | 'connecting' | 'connected' | 'error' = 'idle';
  private reconnectTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initCrossTabChannel();
      this.initVisibilityAndFocusListeners();
    }
  }

  /**
   * Initialize BroadcastChannel for cross-tab instant synchronization
   */
  private initCrossTabChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('ingenium_app_sync_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event?.data?.type === 'SYNC_DATA') {
            this.emitSync({
              source: 'mutation',
              table: event.data.table,
              eventType: event.data.eventType,
              timestamp: Date.now()
            });
          }
        };
      }
    } catch (e) {
      console.warn('[RealtimeSync] BroadcastChannel not supported or restricted:', e);
    }
  }

  /**
   * Revalidate on window focus and document visibility
   */
  private initVisibilityAndFocusListeners() {
    if (typeof window === 'undefined') return;

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastSync = Date.now() - this.lastSyncTime;
        // If it's been more than 6 seconds since last sync, refresh in background
        if (timeSinceLastSync > 6000) {
          this.emitSync({
            source: 'focus',
            timestamp: Date.now()
          });
        }
        this.startAdaptivePolling();
      } else {
        this.stopAdaptivePolling();
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);
    window.addEventListener('online', () => {
      this.emitSync({ source: 'focus', timestamp: Date.now() });
      this.startAdaptivePolling();
    });

    // Start polling if document is currently visible
    if (document.visibilityState === 'visible') {
      this.startAdaptivePolling();
    }
  }

  /**
   * Adaptive Heartbeat Polling: runs periodically when the app is active
   */
  private startAdaptivePolling() {
    this.stopAdaptivePolling();
    // Refresh every 15 seconds while tab is active
    this.pollingTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.emitSync({
          source: 'polling',
          timestamp: Date.now()
        });
      }
    }, 15000);
  }

  private stopAdaptivePolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Subscribe to Supabase Realtime changes across all key application tables
   */
  public initSupabaseRealtime() {
    // Prevent re-entry if already connecting, connected, or if channel is already active
    if (
      this.connectionState === 'connecting' ||
      this.connectionState === 'connected' ||
      this.supabaseChannel !== null ||
      !isSupabaseConfigured ||
      !supabase
    ) {
      return;
    }

    // Set connecting flag synchronously to block race conditions from multiple subscriber mounts
    this.connectionState = 'connecting';

    try {
      // Remove any pre-existing channel with this topic in Supabase client to avoid duplicate callback collisions
      const existingChannels = typeof supabase.getChannels === 'function' ? supabase.getChannels() : [];
      const duplicateChannel = existingChannels.find(
        (ch: any) => ch.topic === 'realtime:ingenium-db-sync' || ch.topic === 'ingenium-db-sync'
      );
      if (duplicateChannel) {
        supabase.removeChannel(duplicateChannel);
      }

      const channel = supabase.channel('ingenium-db-sync');
      this.supabaseChannel = channel;

      const tables = [
        'course_selections',
        'courses',
        'course_categories',
        'course_schedules',
        'course_pricing',
        'enrollments',
        'profiles',
        'payments',
        'teacher_invitations',
        'teacher_course_assignments',
        'course_modules',
        'course_lessons',
        'lesson_materials',
        'class_sessions',
        'class_recordings',
        'quizzes',
        'quiz_attempts',
        'student_lesson_progress',
        'student_course_progress'
      ];

      tables.forEach(table => {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload: any) => {
            this.emitSyncDebounced({
              source: 'realtime',
              table,
              eventType: payload.eventType,
              timestamp: Date.now()
            });
          }
        );
      });

      channel.subscribe((status: string, err?: any) => {
        if (status === 'SUBSCRIBED') {
          this.connectionState = 'connected';
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.connectionState = 'error';
          console.warn('[RealtimeSync] Supabase realtime channel status:', status, err?.message || err);
          this.scheduleReconnect();
        } else if (status === 'CLOSED') {
          if (this.connectionState === 'connected') {
            this.connectionState = 'idle';
            this.scheduleReconnect();
          }
        }
      });
    } catch (err) {
      this.connectionState = 'error';
      console.warn('[RealtimeSync] Could not establish Supabase realtime channel:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule automatic reconnect when connection drops or errors
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.listeners.size === 0) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (
        this.listeners.size > 0 &&
        this.connectionState !== 'connected' &&
        this.connectionState !== 'connecting'
      ) {
        this.cleanupChannel();
        this.initSupabaseRealtime();
      }
    }, 6000);
  }

  /**
   * Cleanly leave and dispose of the Supabase realtime channel
   */
  public cleanupChannel() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.supabaseChannel && supabase) {
      try {
        supabase.removeChannel(this.supabaseChannel);
      } catch (e) {
        // ignore
      }
    }
    this.supabaseChannel = null;
    this.connectionState = 'idle';
  }

  /**
   * Debounces fast concurrent notifications (e.g. multiple db events) into 1 unified sync
   */
  private emitSyncDebounced(event: SyncEvent) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.emitSync(event);
      this.debounceTimer = null;
    }, 300);
  }

  /**
   * Dispatches sync event to all registered React component listeners
   */
  private emitSync(event: SyncEvent) {
    this.lastSyncTime = Date.now();
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (err) {
        console.error('[RealtimeSync] Error in listener callback:', err);
      }
    });
  }

  /**
   * Register a component listener. Automatically initializes the Supabase channel.
   * Returns an unsubscribe cleanup function.
   */
  public subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    this.initSupabaseRealtime();

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.stopAdaptivePolling();
      }
    };
  }

  /**
   * Call this when a local mutation happens (e.g. course created, request approved)
   * to immediately notify all listeners and broadcast to other open tabs
   */
  public notifyMutation(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE') {
    const event: SyncEvent = {
      source: 'mutation',
      table,
      eventType,
      timestamp: Date.now()
    };

    // Broadcast across tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'SYNC_DATA',
          table,
          eventType,
          timestamp: Date.now()
        });
      } catch (e) {
        // ignore
      }
    }

    // Trigger local listeners
    this.emitSync(event);
  }

  /**
   * Manually trigger an immediate sync across all listeners
   */
  public triggerManualSync() {
    this.emitSync({
      source: 'manual',
      timestamp: Date.now()
    });
  }

  public getLastSyncTime(): number {
    return this.lastSyncTime;
  }
}

export const realtimeSync = new RealtimeSyncService();

/**
 * Utility to format relative elapsed time
 */
export function formatTimeAgo(timestamp: number | Date | null): string {
  if (!timestamp) return 'Never';
  const ms = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));

  if (elapsedSeconds < 5) return 'Just now';
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  const mins = Math.floor(elapsedSeconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

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
  private isInitialized: boolean = false;

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
    if (this.isInitialized || !isSupabaseConfigured || !supabase) return;

    try {
      const channel = supabase.channel('ingenium-db-sync');

      const tables = [
        'course_selections',
        'courses',
        'course_categories',
        'course_schedules',
        'course_pricing',
        'enrollments',
        'profiles',
        'payments'
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

      channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.isInitialized = true;
        }
      });

      this.supabaseChannel = channel;
    } catch (err) {
      console.warn('[RealtimeSync] Could not establish Supabase realtime channel:', err);
    }
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

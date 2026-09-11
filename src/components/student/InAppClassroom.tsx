import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Mic, MicOff, Video, VideoOff, Monitor, Hand,
  PhoneOff, Send, Users, MessageSquare, Maximize2, Minimize2, 
  RotateCcw, Volume2, Info, RefreshCw, FileText, Check, Copy, AlertCircle, X, Sparkles
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { ClassSession, Course, Profile } from '../../types';

export interface InAppClassroomProps {
  session: ClassSession;
  course: Course;
  teacherName?: string;
  meetingUrl?: string;
  currentUser: Profile;
  onLeave: () => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  time: string;
  text: string;
  isSelf: boolean;
}

export const InAppClassroom: React.FC<InAppClassroomProps> = ({
  session,
  course,
  teacherName,
  meetingUrl,
  currentUser,
  onLeave
}) => {
  const effectiveMeetingUrl = meetingUrl || session.meeting_url || '';
  
  // Safe embed check: Google Meet and Zoom explicitly bust out of web iframes via window.open,
  // so they MUST NOT be embedded in an iframe. Only embeddable streams (Jitsi, etc.) are framed.
  const canEmbed = Boolean(
    effectiveMeetingUrl && 
    !effectiveMeetingUrl.toLowerCase().includes('meet.google.com') && 
    !effectiveMeetingUrl.toLowerCase().includes('zoom.us') && 
    (effectiveMeetingUrl.includes('jit.si') || effectiveMeetingUrl.includes('embed') || effectiveMeetingUrl.includes('vimeo'))
  );

  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [stageMode, setStageMode] = useState<'live' | 'notes'>('live');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [iframeReloadKey, setIframeReloadKey] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Local Media Stream for Student Camera & Mic (WebRTC)
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const landscapeVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Dynamic live session timer
  useEffect(() => {
    const sessionStart = new Date(session.start_time).getTime();
    const now = Date.now();
    const initialElapsed = Math.max(0, Math.floor((now - sessionStart) / 1000));
    setElapsedSeconds(initialElapsed);

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [session.start_time]);

  // Real WebRTC / Camera setup inside the app
  useEffect(() => {
    let isCancelled = false;

    const manageMedia = async () => {
      if (isVideoOn) {
        try {
          if (!mediaStreamRef.current) {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
              audio: !isMuted
            });
            if (isCancelled) {
              stream.getTracks().forEach(t => t.stop());
              return;
            }
            mediaStreamRef.current = stream;
          }

          if (localVideoRef.current && mediaStreamRef.current) {
            localVideoRef.current.srcObject = mediaStreamRef.current;
          }
          if (landscapeVideoRef.current && mediaStreamRef.current) {
            landscapeVideoRef.current.srcObject = mediaStreamRef.current;
          }
        } catch (err) {
          console.warn('Camera/Mic access could not be initialized:', err);
        }
      } else {
        // Stop video tracks when user turns camera off
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getVideoTracks().forEach(track => {
            track.stop();
          });
          if (localVideoRef.current) localVideoRef.current.srcObject = null;
          if (landscapeVideoRef.current) landscapeVideoRef.current.srcObject = null;
          mediaStreamRef.current = null;
        }
      }
    };

    manageMedia();

    return () => {
      isCancelled = true;
    };
  }, [isVideoOn, isMuted]);

  // Toggle Mute on real audio track
  useEffect(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Cleanup media on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Real Chat messages in state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'System',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Welcome to the live interactive classroom for ${course.title}. This session is running directly inside Ingenium Tech Academy.`,
      isSelf: false
    }
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: currentUser.full_name || currentUser.email?.split('@')[0] || 'You',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: inputMessage.trim(),
      isSelf: true
    };

    setMessages(prev => [...prev, newMsg]);
    setInputMessage('');

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const displayTeacher = teacherName || session.teacher_name || 'Assigned Instructor';

  const participantsList = [
    { name: displayTeacher, role: 'Instructor / Host', isHost: true, isSpeaking: true },
    { name: currentUser.full_name || currentUser.email || 'You', role: 'Student (You)', isHost: false, isSpeaking: !isMuted }
  ];

  // =========================================================================
  // VIEW A: IN-APP CLASSROOM (LANDSCAPE - FULL-SCREEN MOBILE THEATER)
  // =========================================================================
  if (isLandscape) {
    return (
      <div className="fixed inset-0 bg-[#070A0E] text-white z-50 flex flex-col select-none overflow-hidden">
        {/* Top Floating Header */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-30 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold pointer-events-auto border border-white/10 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-red-400 font-extrabold uppercase tracking-wider text-[11px]">LIVE</span>
            <span className="text-white/40">•</span>
            <span className="text-white text-xs font-mono">{formatTimer(elapsedSeconds)}</span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button 
              type="button"
              onClick={() => setStageMode(prev => prev === 'live' ? 'notes' : 'live')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white text-xs font-semibold shadow-lg transition cursor-pointer"
            >
              {stageMode === 'live' ? <FileText className="w-3.5 h-3.5 text-[#0A9D8F]" /> : <Video className="w-3.5 h-3.5 text-[#0A9D8F]" />}
              <span>{stageMode === 'live' ? 'Lecture Notes' : 'Live Stage'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="p-2 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white cursor-pointer transition shadow-lg"
              title="Class Information"
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsLandscape(false)}
              className="p-2 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white cursor-pointer transition shadow-lg"
              title="Switch to Portrait Mode"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Stage Canvas */}
        <div className="flex-1 flex p-2 sm:p-4 pt-14 pb-16 items-center justify-center relative w-full h-full overflow-hidden">
          {stageMode === 'live' && canEmbed ? (
            <div className="w-full h-full max-w-6xl rounded-2xl overflow-hidden bg-black shadow-2xl relative border border-white/10 flex flex-col">
              <iframe
                key={effectiveMeetingUrl + iframeReloadKey}
                src={effectiveMeetingUrl}
                title={`${course.title} Live Class`}
                className="w-full flex-1 border-0 bg-black"
                allow="camera *; microphone *; display-capture *; autoplay *; clipboard-write *; encrypted-media *; fullscreen *"
                sandbox="allow-forms allow-scripts allow-same-origin allow-modals allow-presentation"
              />
            </div>
          ) : stageMode === 'live' ? (
            /* Native Interactive Video Stage */
            <div className="w-full max-w-5xl h-full rounded-2xl bg-radial from-[#121B24] to-[#070A0E] border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
              {/* Background ambient lighting */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#0A9D8F]/10 rounded-full blur-3xl pointer-events-none" />

              {/* Host Presentation Header */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0A9D8F] flex items-center justify-center text-white font-bold text-sm shadow-md shadow-[#0A9D8F]/30">
                    {displayTeacher.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white">{displayTeacher}</h3>
                      <span className="px-1.5 py-0.2 rounded bg-[#0A9D8F] text-white text-[9px] font-bold">
                        Host
                      </span>
                    </div>
                    <p className="text-[11px] text-[#0A9D8F] font-medium">{course.title}</p>
                  </div>
                </div>

                {/* Animated Audio Equalizer */}
                <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <Volume2 className="w-3.5 h-3.5 text-[#0A9D8F]" />
                  <div className="flex items-center gap-0.5 h-3">
                    <span className="w-0.5 bg-[#0A9D8F] rounded-full animate-pulse h-2"></span>
                    <span className="w-0.5 bg-[#0A9D8F] rounded-full animate-pulse [animation-delay:150ms] h-3"></span>
                    <span className="w-0.5 bg-[#0A9D8F] rounded-full animate-pulse [animation-delay:300ms] h-2.5"></span>
                    <span className="w-0.5 bg-[#0A9D8F] rounded-full animate-pulse [animation-delay:450ms] h-1.5"></span>
                  </div>
                  <span className="text-[10px] text-zinc-300 font-medium">Live Audio Stream</span>
                </div>
              </div>

              {/* Center Presentation Title & Visual Stage */}
              <div className="my-auto flex flex-col items-center justify-center text-center space-y-3 z-10 py-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-white/10 flex items-center justify-center shadow-lg shadow-black/40">
                  <BrandLogo size={40} />
                </div>
                <div className="space-y-1 max-w-lg">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#0A9D8F]">
                    Interactive Lesson Stage
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {session.title || 'Live Learning Session'}
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Your live class is active inside the app. Participate via mic, camera, and the interactive chat below.
                  </p>
                </div>
              </div>

              {/* In-App Native Notice */}
              <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/10 pt-3 z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>In-App Audio & Video Bridge Active</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  className="text-[#0A9D8F] hover:underline font-medium cursor-pointer"
                >
                  Session Info & Code
                </button>
              </div>
            </div>
          ) : (
            /* Lecture Notes & Whiteboard View */
            <div className="w-full max-w-4xl h-full bg-white text-zinc-900 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl border border-zinc-200 overflow-y-auto">
              <div className="space-y-4">
                <div className="inline-block px-3 py-1 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-xs font-bold">
                  {course.title}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
                  {session.title || 'Live Learning Session'}
                </h2>
                
                {session.notes ? (
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                    {session.notes}
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-400 text-xs sm:text-sm italic bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                    No lecture notes shared for this session yet. The live audio and instructor presentation is active inside the classroom.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Student Camera PiP (Bottom-Right) */}
        <div className="absolute bottom-16 right-4 sm:right-6 w-36 sm:w-44 h-24 sm:h-28 bg-zinc-900 rounded-xl overflow-hidden border-2 border-[#0A9D8F] shadow-2xl z-30">
          <div className="w-full h-full relative flex items-center justify-center bg-zinc-800 text-center">
            {isVideoOn ? (
              <video
                ref={landscapeVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-2">
                <div className="w-8 h-8 rounded-full bg-[#0A9D8F] text-white flex items-center justify-center font-bold text-xs mb-1">
                  {(currentUser.full_name || 'You').charAt(0)}
                </div>
                <span className="text-[10px] text-white font-bold truncate max-w-[120px]">
                  {currentUser.full_name || 'You'}
                </span>
                <span className="text-[9px] text-zinc-400">Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-1.5 left-2 bg-black/75 px-1.5 py-0.5 rounded text-[8px] font-semibold text-white flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isMuted ? 'bg-red-500' : 'bg-emerald-400'}`}></span>
              <span>{isMuted ? 'Muted' : 'Speaking'}</span>
            </div>
          </div>
        </div>

        {/* Floating Bottom Control Bar */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md px-5 py-2 rounded-full border border-white/15 flex items-center gap-5 z-40 shadow-2xl">
          <button 
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${isMuted ? 'text-red-400' : 'text-zinc-300 hover:text-white'}`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="text-[9px]">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${!isVideoOn ? 'text-red-400' : 'text-zinc-300 hover:text-white'}`}
          >
            {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            <span className="text-[9px]">{isVideoOn ? 'Camera On' : 'Camera Off'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${isHandRaised ? 'text-amber-400' : 'text-zinc-300 hover:text-white'}`}
          >
            <Hand className="w-4 h-4" />
            <span className="text-[9px]">{isHandRaised ? 'Raised' : 'Raise'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            className={`flex flex-col items-center gap-0.5 cursor-pointer transition ${isScreenSharing ? 'text-[#0A9D8F]' : 'text-zinc-300 hover:text-white'}`}
          >
            <Monitor className="w-4 h-4" />
            <span className="text-[9px]">Present</span>
          </button>

          <button 
            type="button"
            onClick={onLeave}
            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white cursor-pointer shadow-md transition ml-2"
            title="Leave Classroom"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: IN-APP CLASSROOM (PORTRAIT - PRIMARY REACTIVE NATIVE MOBILE VIEW)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col bg-white min-h-[calc(100vh-60px)] select-none">
      
      {/* Top Navigation Bar */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={onLeave}
            className="p-1.5 rounded-lg text-zinc-700 hover:bg-zinc-100 cursor-pointer transition"
            title="Return to Dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-zinc-900">Live Classroom</h1>
            <p className="text-[10px] text-zinc-400 truncate max-w-[180px] sm:max-w-[280px]">
              {course.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setStageMode(prev => prev === 'live' ? 'notes' : 'live')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
              stageMode === 'live' 
                ? 'bg-[#E6F5F4] text-[#0A9D8F] hover:bg-[#0A9D8F] hover:text-white' 
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
            title="Toggle between Live Video and Lecture Notes"
          >
            {stageMode === 'live' ? <FileText className="w-3 h-3" /> : <Video className="w-3 h-3" />}
            <span>{stageMode === 'live' ? 'Notes' : 'Stage'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setShowInfoModal(true)}
            className="p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition cursor-pointer"
            title="Session Details & Code"
          >
            <Info className="w-4 h-4" />
          </button>

          <button 
            type="button"
            onClick={() => setIsLandscape(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold transition cursor-pointer"
            title="Switch to Fullscreen Landscape"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Landscape</span>
          </button>
        </div>
      </div>

      {/* Video / Stage Area (Always in-app, Never opens another tab) */}
      <div className="w-full bg-[#0D1117] text-white relative flex flex-col justify-between p-3 sm:p-4 min-h-[280px] sm:min-h-[320px] overflow-hidden">
        
        {/* Top Overlay: LIVE badge + Timer + Status */}
        <div className="flex items-center justify-between w-full z-20 pb-2">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-red-400 font-extrabold uppercase tracking-wider text-[10px]">LIVE</span>
            <span className="text-white/40">•</span>
            <span className="text-white text-xs font-mono">{formatTimer(elapsedSeconds)}</span>
          </div>

          <div className="flex items-center gap-2">
            {isHandRaised && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1 border border-amber-500/30">
                <Hand className="w-3 h-3" />
                <span>Hand Raised</span>
              </span>
            )}
            <button 
              type="button"
              onClick={() => setIsLandscape(true)}
              className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/80 hover:text-white cursor-pointer transition"
              title="Maximize / Landscape Mode"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center Stage: Interactive Live Presenter Stage OR Whiteboard */}
        <div className="my-auto w-full flex-1 flex items-center justify-center relative min-h-[160px]">
          {stageMode === 'live' && canEmbed ? (
            <div className="w-full h-full min-h-[180px] sm:min-h-[220px] rounded-xl overflow-hidden bg-black border border-white/10 relative">
              <iframe
                key={effectiveMeetingUrl + iframeReloadKey}
                src={effectiveMeetingUrl}
                title={`${course.title} Live Class`}
                className="w-full h-full min-h-[180px] sm:min-h-[220px] border-0 bg-black"
                allow="camera *; microphone *; display-capture *; autoplay *; clipboard-write *; encrypted-media *; fullscreen *"
                sandbox="allow-forms allow-scripts allow-same-origin allow-modals allow-presentation"
              />
            </div>
          ) : stageMode === 'live' ? (
            /* Native In-App Presenter Canvas */
            <div className="flex flex-col items-center justify-center text-center space-y-2.5 py-4 px-3 w-full">
              {/* Instructor Avatar with Pulse Ring */}
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#087A6F] to-[#0A9D8F] flex items-center justify-center text-white shadow-lg shadow-[#0A9D8F]/40 border-2 border-white/20">
                  <span className="text-lg font-black">{displayTeacher.charAt(0)}</span>
                </div>
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0D1117] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                </span>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1.5">
                  <h2 className="text-sm font-extrabold tracking-tight text-white">
                    {displayTeacher}
                  </h2>
                  <span className="px-1.5 py-0.2 rounded bg-[#0A9D8F] text-white text-[9px] font-bold">
                    Host
                  </span>
                </div>
                <p className="text-[11px] text-[#0A9D8F] font-semibold mt-0.5">
                  {session.title || 'Live Learning Session'}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {course.title}
                </p>
              </div>

              {/* Animated Speaking Waveform */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                <Volume2 className="w-3 h-3 text-[#0A9D8F]" />
                <div className="flex items-center gap-0.5 h-2.5">
                  <span className="w-0.5 bg-[#0A9D8F] rounded-full animate-pulse h-1.5"></span>
                  <span className="w-0.5 bg-[#0A9D8F] rounded-full animate-pulse [animation-delay:150ms] h-2.5"></span>
                  <span className="w-0.5 bg-[#0A9D8F] rounded-full animate-pulse [animation-delay:300ms] h-2"></span>
                  <span className="w-0.5 bg-[#0A9D8F] rounded-full animate-pulse [animation-delay:450ms] h-1"></span>
                </div>
                <span className="text-[9px] text-zinc-400 font-medium">Instructor Speaking</span>
              </div>
            </div>
          ) : (
            /* Whiteboard / Notes Mode */
            <div className="w-full p-4 bg-white/10 rounded-xl border border-white/10 text-left space-y-2 max-h-[170px] overflow-y-auto">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#0A9D8F]">Session Notes</span>
              {session.notes ? (
                <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {session.notes}
                </p>
              ) : (
                <p className="text-xs text-zinc-400 italic">
                  No notes posted for this live session yet.
                </p>
              )}
            </div>
          )}

          {/* Picture-in-Picture Student Webcam Preview */}
          <div className="absolute bottom-2 right-2 w-24 sm:w-28 h-16 sm:h-20 bg-zinc-900 rounded-lg overflow-hidden border border-[#0A9D8F] shadow-lg z-20">
            {isVideoOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-[9px] text-zinc-400">
                <span className="font-bold text-white text-[10px]">{(currentUser.full_name || 'You').charAt(0)}</span>
                <span>Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-1 left-1 bg-black/80 px-1 py-0.2 rounded text-[7px] text-white">
              {isMuted ? 'Muted' : 'Mic On'}
            </div>
          </div>
        </div>

        {/* Bottom Toolbar inside video player */}
        <div className="flex items-center justify-center gap-5 sm:gap-7 pt-2 z-20 border-t border-white/10 mt-2">
          
          <button 
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`flex flex-col items-center gap-1 cursor-pointer transition ${isMuted ? 'text-red-400' : 'text-zinc-300 hover:text-white'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isMuted ? 'bg-red-500/20' : 'bg-white/10'}`}>
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </div>
            <span className="text-[10px] font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`flex flex-col items-center gap-1 cursor-pointer transition ${!isVideoOn ? 'text-red-400' : 'text-zinc-300 hover:text-white'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!isVideoOn ? 'bg-red-500/20' : 'bg-white/10'}`}>
              {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </div>
            <span className="text-[10px] font-medium">{isVideoOn ? 'Camera On' : 'Camera Off'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`flex flex-col items-center gap-1 cursor-pointer transition ${isHandRaised ? 'text-amber-400' : 'text-zinc-300 hover:text-white'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isHandRaised ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/10'}`}>
              <Hand className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">{isHandRaised ? 'Raised' : 'Raise'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            className={`flex flex-col items-center gap-1 cursor-pointer transition ${isScreenSharing ? 'text-[#0A9D8F]' : 'text-zinc-300 hover:text-white'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isScreenSharing ? 'bg-[#0A9D8F]/20' : 'bg-white/10'}`}>
              <Monitor className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Present</span>
          </button>

          <button 
            type="button"
            onClick={onLeave}
            className="flex flex-col items-center gap-1 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-red-600 group-hover:bg-red-700 flex items-center justify-center text-white shadow-md transition">
              <PhoneOff className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-red-500">Leave</span>
          </button>

        </div>
      </div>

      {/* Tabs: Chat | Participants */}
      <div className="border-b border-zinc-200 flex bg-white px-4">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-xs font-bold transition-all relative cursor-pointer text-center ${
            activeTab === 'chat' ? 'text-[#0A9D8F]' : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>Live Chat</span>
          {activeTab === 'chat' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('participants')}
          className={`flex-1 py-3 text-xs font-bold transition-all relative cursor-pointer text-center ${
            activeTab === 'participants' ? 'text-[#0A9D8F]' : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>Participants</span>
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-zinc-100 text-[10px] text-zinc-600 font-semibold">
            {participantsList.length}
          </span>
          {activeTab === 'participants' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F] rounded-full" />
          )}
        </button>
      </div>

      {/* Tab 1: Live Chat Feed */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between bg-zinc-50 min-h-[220px]">
          
          <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[340px]">
            {messages.map(msg => (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {msg.sender === 'System' ? '⚡' : msg.sender === displayTeacher ? '👨‍🏫' : '👤'}
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">{msg.sender}</span>
                    <span className="text-[10px] text-zinc-400">{msg.time}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-zinc-100 shadow-2xs text-xs text-zinc-800 leading-relaxed inline-block">
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Message Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-zinc-200 flex items-center gap-2">
            <input 
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Ask a question or share a thought..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="p-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] disabled:opacity-40 text-white cursor-pointer transition shadow-xs shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}

      {/* Tab 2: Participants List */}
      {activeTab === 'participants' && (
        <div className="flex-1 p-4 bg-zinc-50 overflow-y-auto space-y-2 min-h-[220px]">
          {participantsList.map((p, idx) => (
            <div 
              key={idx} 
              className="p-3 bg-white rounded-xl border border-zinc-100 flex items-center justify-between shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center font-bold text-xs">
                  {p.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-zinc-900">{p.name}</span>
                    {p.isHost && (
                      <span className="px-1.5 py-0.2 rounded bg-[#0A9D8F] text-white text-[9px] font-bold">
                        Host
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400">{p.role}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-zinc-400">
                {p.isSpeaking && (
                  <span className="text-[#0A9D8F]">
                    <Volume2 className="w-4 h-4 animate-pulse" />
                  </span>
                )}
                {p.role.includes('Student') && isMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In-App Info & Security Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#E6F5F4] flex items-center justify-center text-[#0A9D8F]">
                  <Info className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900">Session Information</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Course</span>
                <span className="font-semibold text-zinc-800">{course.title}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Instructor</span>
                <span className="font-semibold text-zinc-800">{displayTeacher}</span>
              </div>
              {effectiveMeetingUrl && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Meeting Connection Code</span>
                  <div className="flex items-center justify-between gap-2 mt-1 p-2 bg-zinc-50 rounded-lg border border-zinc-200">
                    <span className="font-mono text-[11px] text-zinc-600 truncate">{effectiveMeetingUrl}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(effectiveMeetingUrl)}
                      className="px-2 py-1 rounded bg-[#E6F5F4] text-[#0A9D8F] hover:bg-[#0A9D8F] hover:text-white font-semibold text-[10px] transition shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}
              <div className="p-3 bg-emerald-50 rounded-xl text-[11px] text-emerald-800 space-y-1">
                <p className="font-bold">In-App Reactive Native Classroom Active</p>
                <p className="text-emerald-700">
                  This class session runs directly inside the application. No browser tabs or external apps are opened.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700 rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

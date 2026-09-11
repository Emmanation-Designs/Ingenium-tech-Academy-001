import React, { useState } from 'react';
import { 
  ChevronLeft, Play, Download, Calendar, Clock, 
  FileText, Video, ExternalLink, AlertCircle, Film
} from 'lucide-react';
import { ClassRecording, LessonMaterial, Course } from '../../types';

interface ClassRecordingViewProps {
  course: Course;
  recordings: ClassRecording[];
  materials?: LessonMaterial[];
  onBack: () => void;
}

export const ClassRecordingView: React.FC<ClassRecordingViewProps> = ({
  course,
  recordings,
  materials = [],
  onBack
}) => {
  const [selectedRecording, setSelectedRecording] = useState<ClassRecording | null>(
    recordings.length > 0 ? recordings[0] : null
  );

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-[calc(100vh-60px)]">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1 rounded-lg text-zinc-700 hover:bg-zinc-100 cursor-pointer transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-zinc-900">Class Recording</h1>
            <p className="text-xs text-zinc-400 truncate max-w-[240px]">{course.title}</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6 max-w-xl mx-auto w-full">
        
        {/* If no recordings exist */}
        {recordings.length === 0 ? (
          <div className="py-14 text-center px-4 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400">
              <Film className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-800">No recording available yet.</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                Class recordings for {course.title} will appear here once recorded and uploaded by your instructor.
              </p>
            </div>
          </div>
        ) : (
          /* Active Recording Player & Details */
          <div className="space-y-4">
            {selectedRecording && (
              <div className="space-y-3">
                {/* Video Card Container */}
                <div className="w-full aspect-video bg-zinc-900 rounded-2xl overflow-hidden relative shadow-md flex items-center justify-center group">
                  {selectedRecording.recording_url.includes('youtube.com') || selectedRecording.recording_url.includes('youtu.be') ? (
                    <iframe
                      src={selectedRecording.recording_url.replace('watch?v=', 'embed/')}
                      title={selectedRecording.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : selectedRecording.recording_url.endsWith('.mp4') || selectedRecording.recording_url.endsWith('.webm') ? (
                    <video
                      src={selectedRecording.recording_url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    /* Fallback Link Player Card */
                    <div className="text-center p-6 space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-full bg-[#0A9D8F] flex items-center justify-center text-white shadow-lg">
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{selectedRecording.title}</h4>
                        {selectedRecording.duration && (
                          <span className="text-xs text-zinc-400">{selectedRecording.duration}</span>
                        )}
                      </div>
                      <a
                        href={selectedRecording.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Watch Recording</span>
                      </a>
                    </div>
                  )}

                  {selectedRecording.duration && (
                    <div className="absolute bottom-3 right-3 bg-black/70 px-2 py-0.5 rounded text-[11px] font-mono text-white pointer-events-none">
                      {selectedRecording.duration}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#0A9D8F] text-[10px] font-bold">
                      Session Recording
                    </span>
                    {selectedRecording.recorded_at && (
                      <span className="text-xs text-zinc-400">
                        {formatDate(selectedRecording.recorded_at)}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-zinc-900">
                    {selectedRecording.title}
                  </h2>
                </div>

                {/* Watch / Open Button if external URL */}
                {selectedRecording.recording_url && (
                  <a
                    href={selectedRecording.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Watch Recording</span>
                  </a>
                )}
              </div>
            )}

            {/* List of other recordings if multiple exist */}
            {recordings.length > 1 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  All Recordings ({recordings.length})
                </h3>
                <div className="space-y-2">
                  {recordings.map(rec => (
                    <button
                      key={rec.id}
                      onClick={() => setSelectedRecording(rec)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition cursor-pointer ${
                        selectedRecording?.id === rec.id
                          ? 'border-[#0A9D8F] bg-[#E6F5F4]/30'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600">
                          <Video className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-800 line-clamp-1">{rec.title}</p>
                          <p className="text-[10px] text-zinc-400">{formatDate(rec.recorded_at)}</p>
                        </div>
                      </div>
                      {rec.duration && (
                        <span className="text-[11px] font-mono text-zinc-500">{rec.duration}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Learning Materials Section (Real Data Only) */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Learning Materials
          </h3>

          {materials.length === 0 ? (
            <div className="p-5 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl space-y-1">
              <p className="text-xs font-medium text-zinc-600">No learning materials available yet.</p>
              <p className="text-[11px] text-zinc-400">Class notes and documents will be listed here when uploaded.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {materials.map(mat => (
                <a 
                  key={mat.id}
                  href={mat.file_url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="p-3.5 bg-white border border-zinc-200 hover:border-[#0A9D8F] rounded-xl flex items-center justify-between transition-colors shadow-2xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-800 group-hover:text-[#0A9D8F] transition-colors">
                        {mat.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span className="uppercase font-semibold">{mat.file_type || 'PDF'}</span>
                        {mat.file_size && <span>• {formatBytes(mat.file_size)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-50 text-zinc-600 group-hover:bg-[#E6F5F4] group-hover:text-[#0A9D8F] transition-colors">
                    <Download className="w-4 h-4" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

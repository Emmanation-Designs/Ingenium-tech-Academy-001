import React, { useState } from 'react';
import { 
  ChevronLeft, FileText, Download, CheckCircle, 
  HelpCircle, ChevronDown, ChevronUp, AlertCircle, ArrowRight
} from 'lucide-react';
import { Course, CourseModule, CourseLesson, LessonMaterial, Quiz } from '../../types';
import { BrandLogo } from '../common/BrandLogo';

interface LessonContentViewProps {
  course: Course;
  module?: CourseModule;
  lesson: CourseLesson;
  materials?: LessonMaterial[];
  quizzes?: Quiz[];
  isCompleted: boolean;
  lessonIndex?: number;
  totalLessonsInModule?: number;
  onToggleComplete: () => Promise<void> | void;
  onTakeQuiz?: (quiz: Quiz) => void;
  onBack: () => void;
}

export const LessonContentView: React.FC<LessonContentViewProps> = ({
  course,
  module,
  lesson,
  materials = [],
  quizzes = [],
  isCompleted,
  lessonIndex = 1,
  totalLessonsInModule = 1,
  onToggleComplete,
  onTakeQuiz,
  onBack
}) => {
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleCompleteClick = async () => {
    try {
      setSubmitting(true);
      await onToggleComplete();
    } finally {
      setSubmitting(false);
    }
  };

  const publishedQuizzes = quizzes.filter(q => q.is_published);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-[calc(100vh-60px)] pb-24">
      
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
            <h1 className="text-base font-bold text-zinc-900">Lesson Content</h1>
            <p className="text-xs text-zinc-400 truncate max-w-[240px]">
              {module?.title || course.title}
            </p>
          </div>
        </div>
        <BrandLogo size="xs" />
      </div>

      <div className="p-5 space-y-6 max-w-xl mx-auto w-full">
        
        {/* Lesson Badge & Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-[11px] font-bold">
            <span>Lesson {lessonIndex} of {totalLessonsInModule}</span>
          </div>

          <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight">
            {lesson.title}
          </h2>

          {lesson.duration && (
            <p className="text-xs text-zinc-400 font-medium">Estimated duration: {lesson.duration}</p>
          )}

          {lesson.content ? (
            <div className="text-xs text-zinc-600 leading-relaxed pt-1 whitespace-pre-wrap">
              {lesson.content}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 italic">No written description provided for this lesson.</p>
          )}
        </div>

        {/* Learning Materials / PDFs */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Learning Materials
          </h3>

          {materials.length === 0 ? (
            <div className="p-5 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl space-y-1">
              <p className="text-xs font-medium text-zinc-600">No learning materials available yet.</p>
              <p className="text-[11px] text-zinc-400">PDFs and documents uploaded for this lesson will appear here.</p>
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
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-800 group-hover:text-[#0A9D8F] transition-colors line-clamp-1">
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

        {/* Quizzes for this lesson */}
        {publishedQuizzes.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Lesson Quizzes
            </h3>
            <div className="space-y-2.5">
              {publishedQuizzes.map(q => (
                <div 
                  key={q.id}
                  className="p-4 bg-white border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#0A9D8F]" />
                      <h4 className="text-xs font-bold text-zinc-900">{q.title}</h4>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Pass mark: {q.pass_percentage}% • Total marks: {q.total_marks}
                    </p>
                  </div>
                  {onTakeQuiz && (
                    <button
                      onClick={() => onTakeQuiz(q)}
                      className="px-3 py-1.5 rounded-lg bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <span>Take Quiz</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Sticky Bottom Action: Mark as Complete */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 flex justify-center z-20">
        <div className="w-full max-w-xl">
          <button 
            onClick={handleCompleteClick}
            disabled={submitting}
            className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50 ${
              isCompleted 
                ? 'bg-emerald-50 text-[#0A9D8F] border border-emerald-300 hover:bg-emerald-100' 
                : 'bg-[#0A9D8F] hover:bg-[#087A6F] text-white'
            }`}
          >
            <CheckCircle className={`w-4 h-4 ${isCompleted ? 'text-[#0A9D8F]' : 'text-white'}`} />
            <span>
              {submitting 
                ? 'Updating Progress...' 
                : isCompleted 
                ? 'Completed (Click to unmark)' 
                : 'Mark as Complete'}
            </span>
          </button>
        </div>
      </div>

    </div>
  );
};

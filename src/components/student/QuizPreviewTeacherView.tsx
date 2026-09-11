import React, { useState } from 'react';
import { ChevronLeft, CheckCircle2, Check, Edit3, Sparkles, AlertCircle } from 'lucide-react';
import { ParsedQuestion } from '../../lib/quizParser';

interface QuizPreviewTeacherViewProps {
  quizTitle?: string;
  parsedQuestions?: ParsedQuestion[];
  onBack: () => void;
  onPublish?: () => void;
}

export const QuizPreviewTeacherView: React.FC<QuizPreviewTeacherViewProps> = ({
  quizTitle = 'Quiz Preview',
  parsedQuestions = [],
  onBack,
  onPublish
}) => {
  const [activeTab, setActiveTab] = useState<'parsed' | 'edit'>('parsed');
  const [published, setPublished] = useState<boolean>(false);

  const handlePublish = () => {
    setPublished(true);
    setTimeout(() => {
      if (onPublish) onPublish();
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-[calc(100vh-60px)]">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-zinc-100 flex items-center gap-3 sticky top-0 bg-white z-20">
        <button 
          onClick={onBack}
          className="p-1 rounded-lg text-zinc-700 hover:bg-zinc-100 cursor-pointer transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-zinc-900">{quizTitle}</h1>
      </div>

      {/* Tabs: Parsed Questions | Edit */}
      <div className="border-b border-zinc-200 flex bg-white px-4">
        <button
          onClick={() => setActiveTab('parsed')}
          className={`flex-1 py-3 text-xs font-bold transition-all relative cursor-pointer text-center ${
            activeTab === 'parsed' ? 'text-[#0A9D8F]' : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>Parsed Questions</span>
          {activeTab === 'parsed' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F] rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 py-3 text-xs font-bold transition-all relative cursor-pointer text-center ${
            activeTab === 'edit' ? 'text-[#0A9D8F]' : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>Edit</span>
          {activeTab === 'edit' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F] rounded-full" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-xl mx-auto w-full pb-24">
        
        {parsedQuestions.length === 0 ? (
          <div className="py-12 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl space-y-2 p-6">
            <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-xs font-bold text-zinc-800">No questions parsed yet.</h3>
            <p className="text-[11px] text-zinc-500">
              Paste the structured quiz text in the quiz creator to preview questions before publishing.
            </p>
          </div>
        ) : (
          <>
            {/* Success Alert Banner */}
            <div className="p-3.5 bg-[#E6F5F4] border border-[#0A9D8F]/20 rounded-2xl flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#0A9D8F] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#087A6F]">Quiz parsed successfully!</h4>
                <p className="text-[11px] text-[#0A9D8F] leading-normal">
                  {parsedQuestions.length} questions found. Please review before publishing.
                </p>
              </div>
            </div>

            {/* Questions List */}
            {parsedQuestions.map((q, idx) => (
              <div key={idx} className="p-4 bg-white border border-zinc-200 rounded-2xl space-y-3 shadow-2xs">
                <span className="text-[11px] font-bold text-zinc-400">Question {q.number || (idx + 1)}</span>
                <h3 className="text-xs font-bold text-zinc-900">{q.questionText}</h3>

                <div className="space-y-2 pt-1">
                  {q.options.map(opt => {
                    const isCorrect = opt.key.toUpperCase() === q.correctAnswer.toUpperCase();
                    return (
                      <div key={opt.key} className={`flex items-center gap-2 text-xs ${isCorrect ? 'text-[#0A9D8F] font-bold' : 'text-zinc-500'}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                          isCorrect ? 'border-2 border-[#0A9D8F]' : 'border border-zinc-300'
                        }`}>
                          {isCorrect && <span className="w-2 h-2 rounded-full bg-[#0A9D8F]" />}
                        </div>
                        <span>{opt.key}. {opt.text}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-[#0A9D8F]">Correct Answer: {q.correctAnswer}</span>
                  <span className="text-zinc-400">Marks: {q.marks || 1}</span>
                </div>
              </div>
            ))}
          </>
        )}

      </div>

      {/* Sticky Bottom Action */}
      {parsedQuestions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 flex justify-center z-20">
          <div className="w-full max-w-xl">
            <button 
              onClick={handlePublish}
              disabled={published}
              className="w-full py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {published ? 'Quiz Published!' : 'Publish Quiz'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

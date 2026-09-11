import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Award, CheckCircle, XCircle, ArrowRight, 
  HelpCircle, AlertCircle, RotateCcw, Check, Clock
} from 'lucide-react';
import { Quiz, QuizQuestion, QuizAttempt, Profile } from '../../types';
import { learningService } from '../../services/learningService';

interface QuizStudentViewProps {
  quiz: Quiz;
  currentUser: Profile;
  onBack: () => void;
  onComplete?: (attempt: QuizAttempt) => void;
}

export const QuizStudentView: React.FC<QuizStudentViewProps> = ({
  quiz,
  currentUser,
  onBack,
  onComplete
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [detailedQuiz, setDetailedQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedAttempt, setSubmittedAttempt] = useState<QuizAttempt | null>(null);
  const [showReview, setShowReview] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load real quiz questions and options from Supabase
  useEffect(() => {
    let isMounted = true;
    const loadQuiz = async () => {
      try {
        setLoading(true);
        const data = await learningService.getQuizDetails(quiz.id);
        if (isMounted) {
          setDetailedQuiz(data || quiz);
        }
      } catch (e: any) {
        if (isMounted) setErrorMsg(e.message || 'Failed to load quiz');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadQuiz();
    return () => { isMounted = false; };
  }, [quiz.id]);

  const questions: QuizQuestion[] = detailedQuiz?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!detailedQuiz) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);

      const formattedAnswers = questions.map(q => ({
        questionId: q.id,
        selectedOption: selectedAnswers[q.id] || ''
      }));

      const attempt = await learningService.submitQuizAttempt(
        detailedQuiz.id,
        detailedQuiz.course_id,
        currentUser.id,
        formattedAnswers
      );

      setSubmittedAttempt(attempt);
      if (onComplete) onComplete(attempt);
    } catch (e: any) {
      console.error('Quiz submission error:', e);
      setErrorMsg(e.message || 'Failed to submit quiz attempt.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white">
        <div className="w-8 h-8 border-3 border-[#0A9D8F] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-zinc-500 font-medium mt-3">Loading quiz questions from database...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <h3 className="text-sm font-bold text-zinc-900">{errorMsg}</h3>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-700 cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-white min-h-[calc(100vh-60px)]">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
          <button onClick={onBack} className="p-1 rounded-lg text-zinc-700 hover:bg-zinc-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-zinc-900">{quiz.title}</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <HelpCircle className="w-10 h-10 text-zinc-400" />
          <h3 className="text-sm font-bold text-zinc-800">No questions available in this quiz yet.</h3>
          <p className="text-xs text-zinc-500 max-w-sm">Your instructor has created the quiz container, but questions have not been populated yet.</p>
          <button onClick={onBack} className="px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold cursor-pointer">
            Return to Lesson
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 10: REAL QUIZ RESULTS (Graded by Supabase)
  // =========================================================================
  if (submittedAttempt) {
    const passed = submittedAttempt.passed;
    return (
      <div className="flex-1 flex flex-col bg-white min-h-[calc(100vh-60px)] p-6">
        <div className="max-w-md mx-auto w-full space-y-6 text-center my-auto">
          
          {/* Trophy / Result Badge */}
          <div className="relative mx-auto w-24 h-24 rounded-full bg-[#E6F5F4] flex items-center justify-center shadow-inner">
            <Award className={`w-12 h-12 ${passed ? 'text-[#0A9D8F]' : 'text-amber-500'}`} />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
              {passed ? 'Quiz Completed!' : 'Quiz Attempt Finished'}
            </h2>
            <p className="text-xs text-zinc-500">
              {passed 
                ? 'Congratulations! You passed this quiz assessment.' 
                : 'You did not reach the passing percentage. Review the answers below.'}
            </p>
          </div>

          {/* Real Score Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Your Score</span>
              <span className="text-2xl font-black text-zinc-900 mt-1 block">
                {submittedAttempt.score} / {submittedAttempt.total_marks}
              </span>
            </div>

            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Percentage</span>
              <span className={`text-2xl font-black mt-1 block ${passed ? 'text-[#0A9D8F]' : 'text-amber-600'}`}>
                {submittedAttempt.percentage}%
              </span>
            </div>
          </div>

          {/* Toggle Answer Review */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setShowReview(!showReview)}
              className="w-full py-3 rounded-xl border border-zinc-200 hover:border-zinc-300 text-xs font-bold text-zinc-700 transition cursor-pointer"
            >
              {showReview ? 'Hide Review' : 'View Correct Answers'}
            </button>

            {showReview && (
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-left space-y-4 max-h-[300px] overflow-y-auto">
                {questions.map((q, idx) => {
                  const studentAnswer = selectedAnswers[q.id];
                  const isCorrect = studentAnswer === q.correct_answer;
                  return (
                    <div key={q.id} className="space-y-1 border-b border-zinc-200 pb-3 last:border-none">
                      <p className="text-xs font-bold text-zinc-800">
                        {idx + 1}. {q.question_text}
                      </p>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className={isCorrect ? 'text-[#0A9D8F] font-semibold' : 'text-red-500 font-semibold'}>
                          Your answer: {studentAnswer || 'None'} {isCorrect ? '✓' : '✗'}
                        </span>
                        {!isCorrect && (
                          <span className="text-zinc-500 font-medium">
                            Correct: {q.correct_answer}
                          </span>
                        )}
                      </div>
                      {q.explanation && (
                        <p className="text-[10px] text-zinc-400 italic mt-0.5">{q.explanation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={onBack}
              className="w-full py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              Back to Course
            </button>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 9: REAL STUDENT QUIZ (Taking Mode)
  // =========================================================================
  const isAnswered = Boolean(selectedAnswers[currentQuestion.id]);
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

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
            <h1 className="text-base font-bold text-zinc-900">Quiz</h1>
            <p className="text-xs text-zinc-400 truncate max-w-[240px]">{quiz.title}</p>
          </div>
        </div>

        <div className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 font-mono text-xs font-semibold">
          {currentQuestionIndex + 1} of {questions.length}
        </div>
      </div>

      {/* Question Card */}
      <div className="p-5 space-y-6 max-w-xl mx-auto w-full">
        
        {/* Progress Bar */}
        <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-[#0A9D8F] h-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question Title */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A9D8F]">
            Question {currentQuestionIndex + 1}
          </span>
          <h2 className="text-base sm:text-lg font-extrabold text-zinc-900 leading-snug">
            {currentQuestion.question_text}
          </h2>
        </div>

        {/* Options List */}
        <div className="space-y-3 pt-2">
          {currentQuestion.options && currentQuestion.options.length > 0 ? (
            currentQuestion.options.map(opt => {
              const isSelected = selectedAnswers[currentQuestion.id] === opt.option_key;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(currentQuestion.id, opt.option_key)}
                  className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    isSelected 
                      ? 'border-[#0A9D8F] bg-[#E6F5F4]/40 text-zinc-900' 
                      : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                      isSelected 
                        ? 'bg-[#0A9D8F] text-white' 
                        : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {opt.option_key}
                    </span>
                    <span className="text-xs font-medium leading-relaxed">{opt.option_text}</span>
                  </div>

                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-[#0A9D8F] bg-[#0A9D8F]' : 'border-zinc-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-400 text-center">
              No multiple choice options recorded for this question.
            </div>
          )}
        </div>

      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 flex justify-center z-20">
        <div className="w-full max-w-xl flex items-center gap-3">
          {currentQuestionIndex > 0 && (
            <button
              onClick={handlePrev}
              className="py-3.5 px-4 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold text-zinc-700 cursor-pointer transition"
            >
              Previous
            </button>
          )}

          {isLastQuestion ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={submitting}
              className="flex-1 py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? 'Scoring Quiz...' : 'Submit Quiz'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Next Question</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

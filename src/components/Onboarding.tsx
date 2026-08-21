import React, { useState } from 'react';
import { ArrowRight, BookOpen, Clock, Calendar, GraduationCap, CheckCircle2 } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Start learning today",
      description: "Acquire high-demand practical skills and build your career foundation with training designed by technology experts.",
      icon: <GraduationCap className="w-16 h-16 text-[#00B074]" />,
    },
    {
      title: "Practical Courses & Career Impact",
      description: "Our curriculums are tailored directly to the demands of the modern workplace, enabling immediate career transition and impact.",
      icon: <BookOpen className="w-16 h-16 text-[#00B074]" />,
    },
    {
      title: "The Learning Experience",
      description: "Select from our specialized list of courses, choose your preferred available class times, and interact directly with professional instructors in live virtual sessions.",
      features: [
        "Select industry-standard courses",
        "Flexible daily/weekly class schedules",
        "Expert instructors & live interactive classes",
        "Dedicated student community support"
      ],
      icon: <Clock className="w-16 h-16 text-[#00B074]" />,
    },
    {
      title: "Your Educational Journey",
      description: "Empower yourself with professional certifications, audit trials, modules, and lessons tailored to your timezone and schedule. Let's begin building.",
      icon: <CheckCircle2 className="w-16 h-16 text-[#00B074]" />,
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const activeStep = steps[currentStep];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen dot-grid text-white px-6 py-12 select-none font-sans">
      {/* Mobile App Container Frame (Virtual Device style, centered on larger screens) */}
      <div className="w-full max-w-[420px] bg-zinc-900 border border-zinc-800 flex flex-col justify-between min-h-[700px] rounded-[32px] p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center mt-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00B074] animate-pulse"></span>
            <span className="text-xs uppercase font-bold tracking-[0.2em] text-zinc-400">Ingenium Tech Academy</span>
          </div>
        </div>

        {/* Dynamic Step Content */}
        <div className="flex-1 flex flex-col justify-center my-8 text-center px-2">
          {/* Centered Graphic Area */}
          <div className="flex justify-center mb-8 transform hover:scale-105 transition-transform duration-300">
            <div className="w-28 h-28 bg-zinc-950 border border-zinc-800 rounded-3xl flex items-center justify-center shadow-lg">
              {activeStep.icon}
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight mb-4 min-h-[72px] flex items-center justify-center">
            {activeStep.title}
          </h2>

          {/* Description */}
          <p className="text-sm text-zinc-400 leading-relaxed max-w-[320px] mx-auto mb-6">
            {activeStep.description}
          </p>

          {/* Special list features on Step 3 */}
          {activeStep.features && (
            <div className="space-y-2 max-w-[280px] mx-auto text-left mt-2 bg-zinc-950 p-4 border border-zinc-800 rounded-2xl">
              {activeStep.features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00B074]"></span>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Navigation & Indicators */}
        <div className="mt-auto flex flex-col gap-6">
          {/* Slider Indicators */}
          <div className="flex justify-center gap-2">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  currentStep === idx ? 'w-8 bg-[#00B074]' : 'w-2 bg-zinc-800 hover:bg-zinc-700'
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center justify-between gap-4">
            {currentStep > 0 ? (
              <button
                onClick={handlePrev}
                className="py-3 px-6 text-sm font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Back
              </button>
            ) : (
              <div className="w-16"></div> // spacer
            )}

            <button
              onClick={handleNext}
              className="flex-1 py-3 px-6 rounded-2xl bg-[#00B074] hover:bg-[#00905D] text-white font-extrabold text-sm border border-zinc-800 shadow-lg active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                'Next'
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

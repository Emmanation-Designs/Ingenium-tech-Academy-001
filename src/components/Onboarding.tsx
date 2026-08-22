import React, { useState } from 'react';
import { ArrowRight, BookOpen, Clock, Calendar, GraduationCap, CheckCircle2 } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const BookWithDotsIcon = () => (
  <svg width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <circle cx="10" cy="11" r="1.2" fill="currentColor" />
    <circle cx="13" cy="11" r="1.2" fill="currentColor" />
    <circle cx="16" cy="11" r="1.2" fill="currentColor" />
  </svg>
);

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Start learning today",
      description: "Nowadays e-learning is best for learning for everyone. So you can sign up for learning our lesson. Our all lesson is best.",
      icon: <BookWithDotsIcon />,
    },
    {
      title: "Select your course",
      description: "Explore highly-coveted technological domains designed by global experts to launch your career.",
      icon: <BookOpen className="w-20 h-20 text-white" />,
    },
    {
      title: "Flexible Schedules",
      description: "Coordinate interactive training times and live sessions synced seamlessly to your native timezone.",
      icon: <Clock className="w-20 h-20 text-white" />,
    },
    {
      title: "Your Academic Journey",
      description: "Directly connect with professional course instructors, build your selections, and secure accredited records.",
      icon: <GraduationCap className="w-20 h-20 text-white" />,
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 px-6 py-12 select-none font-sans">
      {/* Mobile App Container Frame (Virtual Device style, matching the mockup) */}
      <div className="w-full max-w-[400px] bg-[#00B074] border border-emerald-500/20 flex flex-col justify-between min-h-[720px] rounded-[36px] p-7 shadow-2xl relative overflow-hidden transition-all duration-300">
        
        {/* Mockup Status Bar */}
        <div className="flex justify-between items-center text-white/80 px-2 text-[11px] font-bold">
          <span>10:16</span>
          <div className="flex items-center gap-1.5">
            {/* Cellular, WiFi, Battery bars */}
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.07 19.64 10.49 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
            </svg>
            <span className="w-5 h-2.5 border border-white/80 rounded-sm p-0.5 flex items-center">
              <span className="bg-white h-full w-4/5 block rounded-2xs"></span>
            </span>
          </div>
        </div>

        {/* Dynamic Step Content */}
        <div className="flex-1 flex flex-col justify-center my-8 text-center px-2">
          {/* Centered Book Icon */}
          <div className="flex justify-center mb-10 transform hover:scale-105 transition-transform duration-300">
            <div className="w-32 h-32 flex items-center justify-center">
              {activeStep.icon}
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight mb-4 min-h-[80px] flex items-center justify-center px-4">
            {activeStep.title}
          </h2>

          {/* Description */}
          <p className="text-white/85 text-xs font-medium leading-relaxed max-w-[290px] mx-auto mb-6">
            {activeStep.description}
          </p>
        </div>

        {/* Footer Navigation & Indicators */}
        <div className="mt-auto flex flex-col gap-8">
          {/* Slider Indicators */}
          <div className="flex justify-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentStep === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
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
                className="py-3.5 px-5 text-xs font-black text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                Back
              </button>
            ) : (
              <div className="w-14"></div> // spacer
            )}

            <button
              onClick={handleNext}
              className="flex-1 py-3.5 px-6 rounded-full bg-white hover:bg-zinc-100 text-[#00B074] font-black text-sm shadow-md active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {currentStep === steps.length - 1 ? (
                <span>Get started</span>
              ) : (
                <span>Next</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

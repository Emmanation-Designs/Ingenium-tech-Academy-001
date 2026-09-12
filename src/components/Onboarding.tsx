import React, { useState } from 'react';
import { ArrowRight, BookOpen, Clock, Calendar, GraduationCap, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from './common/BrandLogo';

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-4 sm:p-6 md:p-8 select-none font-sans overflow-y-auto pt-safe pb-safe">
      {/* Sleek Onboarding Card Frame */}
      <div className="w-full max-w-sm sm:max-w-md bg-[#0A9D8F] border border-emerald-500/20 flex flex-col justify-between min-h-[500px] sm:min-h-[580px] rounded-3xl sm:rounded-[32px] p-5 sm:p-7 shadow-2xl relative transition-all duration-300 my-auto">
        
        {/* Official Brand Logo Header */}
        <div className="flex items-center justify-center pt-1 pb-2">
          <BrandLogo size="md" showText={true} showSubtitle={true} variant="light" />
        </div>

        {/* Dynamic Step Content */}
        <div className="flex-1 flex flex-col justify-center my-4 sm:my-6 text-center px-1 sm:px-2">
          {/* Centered Book Icon */}
          <div className="flex justify-center mb-4 sm:mb-8 transform hover:scale-105 transition-transform duration-300">
            <div className="w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center">
              {activeStep.icon}
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight mb-2 sm:mb-4 min-h-[56px] sm:min-h-[72px] flex items-center justify-center px-2">
            {activeStep.title}
          </h2>

          {/* Description */}
          <p className="text-white/90 text-xs sm:text-sm font-medium leading-relaxed max-w-[320px] mx-auto mb-2 sm:mb-4">
            {activeStep.description}
          </p>
        </div>

        {/* Footer Navigation & Indicators */}
        <div className="mt-auto flex flex-col gap-4 sm:gap-6">
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
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            {currentStep > 0 ? (
              <button
                onClick={handlePrev}
                className="py-3 px-4 sm:py-3.5 sm:px-5 min-h-[44px] text-xs font-black text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                Back
              </button>
            ) : (
              <div className="w-14"></div> // spacer
            )}

            <button
              onClick={handleNext}
              className="flex-1 py-3 px-5 sm:py-3.5 sm:px-6 min-h-[44px] rounded-full bg-white hover:bg-zinc-100 text-[#0A9D8F] font-black text-xs sm:text-sm shadow-md active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {currentStep === steps.length - 1 ? (
                <span>Get started</span>
              ) : (
                <span>Next</span>
              )}
            </button>
          </div>

          {/* Direct Sign In option for returning users */}
          <div className="text-center pt-1 pb-1">
            <button
              type="button"
              onClick={onComplete}
              className="text-xs font-semibold text-white/95 hover:text-white underline underline-offset-4 cursor-pointer transition-colors min-h-[36px] inline-flex items-center"
            >
              Already have an account? Sign In
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { BrandLogo } from './common/BrandLogo';
import {
  Slide1Illustration,
  Slide2Illustration,
  Slide3Illustration,
  Slide4Illustration,
} from './onboarding/OnboardingIllustrations';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const steps = [
    {
      titlePrefix: "Start learning",
      titleHighlight: "today",
      description:
        "Ingenium Tech Academy gives you the skills, knowledge and support you need to build a better future. Learn at your own pace, from anywhere in the world.",
      illustration: <Slide1Illustration />,
    },
    {
      titlePrefix: "Select your",
      titleHighlight: "courses",
      description:
        "Explore cutting-edge tech curricula designed by industry experts. Master full-stack development, artificial intelligence, cloud architecture, and cybersecurity.",
      illustration: <Slide2Illustration />,
    },
    {
      titlePrefix: "Flexible",
      titleHighlight: "schedules",
      description:
        "Coordinate interactive training times and live sessions synced seamlessly to your native timezone. Master new skills without interrupting your daily commitments.",
      illustration: <Slide3Illustration />,
    },
    {
      titlePrefix: "Your academic",
      titleHighlight: "journey",
      description:
        "Directly connect with professional course instructors, build verified portfolio projects, and secure accredited records recognized worldwide.",
      illustration: <Slide4Illustration />,
    },
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  // Touch swipe handling for mobile
  const minSwipeDistance = 50;
  const onTouchStartHandler = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMoveHandler = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  const activeStep = steps[currentStep];

  return (
    <div className="min-h-screen w-full bg-[#F4F6F8] sm:bg-[#EDF2F0] flex items-center justify-center p-0 sm:p-4 md:p-6 select-none font-sans overflow-x-hidden">
      {/* Mobile/Device Card Container */}
      <div
        className="w-full max-w-[440px] min-h-screen sm:min-h-[780px] sm:max-h-[880px] bg-white sm:rounded-[36px] sm:shadow-2xl sm:border sm:border-[#0A9D8F]/15 flex flex-col justify-between relative overflow-hidden transition-all duration-300"
        onTouchStart={onTouchStartHandler}
        onTouchMove={onTouchMoveHandler}
        onTouchEnd={onTouchEndHandler}
      >
        {/* CORNER ORGANIC BRAND WAVES (TOP-LEFT) */}
        <svg
          className="absolute top-0 left-0 w-36 sm:w-44 h-36 sm:h-44 pointer-events-none z-0"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Mint under-wave */}
          <path
            d="M 0 0 L 150 0 C 120 70 60 110 0 130 Z"
            fill="#10B981"
            fillOpacity="0.2"
          />
          {/* Secondary teal wave */}
          <path
            d="M 0 0 L 120 0 C 100 60 50 90 0 100 Z"
            fill="#0A9D8F"
            fillOpacity="0.45"
          />
          {/* Main rich emerald wave */}
          <path
            d="M 0 0 L 85 0 C 75 45 40 70 0 80 Z"
            fill="#0A9D8F"
          />
          {/* Contour line */}
          <path
            d="M 0 145 C 70 125 135 75 160 0"
            stroke="#0A9D8F"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            fill="none"
          />
        </svg>

        {/* CORNER ORGANIC BRAND WAVES (BOTTOM-RIGHT) */}
        <svg
          className="absolute bottom-0 right-0 w-40 sm:w-52 h-40 sm:h-52 pointer-events-none z-0"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Soft mint bloom halo */}
          <circle
            cx="160"
            cy="160"
            r="90"
            fill="#E6F5F4"
            fillOpacity="0.8"
          />
          {/* Secondary teal wave */}
          <path
            d="M 200 200 L 200 80 C 130 95 85 145 70 200 Z"
            fill="#10B981"
            fillOpacity="0.25"
          />
          {/* Main rich emerald wave */}
          <path
            d="M 200 200 L 200 115 C 150 130 115 165 105 200 Z"
            fill="#0A9D8F"
          />
          {/* Deep corner wave */}
          <path
            d="M 200 200 L 200 140 C 165 150 140 175 130 200 Z"
            fill="#065F56"
          />
          {/* Contour line */}
          <path
            d="M 50 200 C 70 130 130 70 200 50"
            stroke="#0A9D8F"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            fill="none"
          />
        </svg>

        {/* HEADER: Back Button (if > 0) & Centered Brand Logo */}
        <div className="relative z-10 pt-7 sm:pt-8 px-6 flex items-center justify-center">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-6 top-8 w-9 h-9 rounded-full bg-gray-50 border border-gray-200/80 text-gray-700 hover:text-gray-950 hover:bg-gray-100 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 -ml-0.5" />
            </button>
          )}

          {/* Centered Logo Wordmark exactly as in design */}
          <div className="flex items-center gap-3">
            <BrandLogo iconOnly size={44} className="shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-2xl font-black text-gray-950 tracking-tight leading-none">
                Ingenium
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#0A9D8F] tracking-normal leading-tight mt-0.5">
                Tech Academy
              </span>
            </div>
          </div>
        </div>

        {/* CENTER CONTENT: Illustration + Two-Tone Title + Description */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-8 py-4 text-center">
          {/* Centered Dynamic 3D Illustration */}
          <div className="w-full flex items-center justify-center min-h-[220px] sm:min-h-[260px] max-h-[280px] my-2 transition-transform duration-300">
            <div className="w-full max-w-[320px] flex items-center justify-center">
              {activeStep.illustration}
            </div>
          </div>

          {/* Two-Tone Headline */}
          <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight leading-[1.15] mt-4 mb-3 sm:mb-4">
            <span>{activeStep.titlePrefix} </span>
            <br />
            <span className="text-[#0A9D8F]">{activeStep.titleHighlight}</span>
          </h1>

          {/* Subtitle / Description */}
          <p className="text-xs sm:text-sm text-gray-600 font-normal leading-relaxed max-w-[320px] sm:max-w-[340px] mx-auto">
            {activeStep.description}
          </p>
        </div>

        {/* BOTTOM SECTION: Pagination Dots + Next Button + Sign In */}
        <div className="relative z-10 px-6 sm:px-8 pb-8 sm:pb-9 pt-2 flex flex-col items-center gap-5 sm:gap-6">
          {/* Pagination Indicators (4 slides) */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`transition-all duration-300 cursor-pointer ${
                  currentStep === idx
                    ? 'w-7 sm:w-8 h-2 sm:h-2.5 rounded-full bg-[#0A9D8F]'
                    : 'w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#CBD5E1] hover:bg-[#94A3B8]'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action CTA Button */}
          <button
            onClick={handleNext}
            className="w-full max-w-sm py-4 px-6 rounded-full bg-[#0A9D8F] hover:bg-[#088276] active:scale-[0.99] text-white font-bold text-base sm:text-lg shadow-lg shadow-[#0A9D8F]/25 flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer"
          >
            <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Sign In Link for existing accounts */}
          <div className="text-center">
            <span className="text-xs sm:text-sm text-gray-600 font-medium">
              Already have an account?{' '}
            </span>
            <button
              type="button"
              onClick={onComplete}
              className="text-xs sm:text-sm text-[#0A9D8F] font-bold underline underline-offset-4 hover:text-[#088276] cursor-pointer transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

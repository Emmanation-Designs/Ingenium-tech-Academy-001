/**
 * Ingenium Tech Academy - Intelligent Quiz Parser
 * Parses bulk pasted quiz text from teachers into structured questions, options, answers, and marks.
 */

export interface ParsedOption {
  key: string; // 'A', 'B', 'C', 'D', etc.
  text: string;
}

export interface ParsedQuestion {
  id: string; // temporary client UUID
  number: number;
  questionText: string;
  options: ParsedOption[];
  correctAnswer: string; // 'A', 'B', etc.
  marks: number;
  explanation?: string;
  hasError: boolean;
  errorMessage?: string;
}

export interface QuizParseResult {
  questions: ParsedQuestion[];
  totalQuestions: number;
  totalMarks: number;
  hasErrors: boolean;
  errorCount: number;
}

export function parseQuizText(rawText: string): QuizParseResult {
  if (!rawText || !rawText.trim()) {
    return {
      questions: [],
      totalQuestions: 0,
      totalMarks: 0,
      hasErrors: false,
      errorCount: 0,
    };
  }

  const lines = rawText.split(/\r?\n/);
  const questions: ParsedQuestion[] = [];
  
  let currentQ: Partial<ParsedQuestion> | null = null;
  let currentOptions: ParsedOption[] = [];
  let currentOption: ParsedOption | null = null;
  let readingQuestionText = false;
  let questionCounter = 0;

  // Patterns for Question Starters:
  // "1.", "1)", "1:", "1 -", "Question 1:", "Question 1.", "Q1:", "Q1.", "Q.1:"
  const qStartRegex = /^\s*(?:(?:Question|Q)\s*[:.]?\s*)?(\d+)\s*[\.\)\:\-]\s*(.*)$/i;

  // Patterns for Options:
  // "A.", "A)", "A:", "(A)", "[A]", "a.", "a)"
  const optStartRegex = /^\s*(?:\(?([A-Ga-g])[\.\)\:\]]|\b([A-Ga-g])\.)\s*(.*)$/;

  // Patterns for Correct Answer:
  // "Answer: A", "Ans: A", "Correct Answer: B", "Correct: B", "Ans - C", "Answer = D"
  const ansRegex = /^\s*(?:Correct\s+)?(?:Answer|Ans)\s*[:\=\-]\s*\(?([A-Ga-g])\)?/i;

  // Patterns for Marks:
  // "Marks: 2", "Mark: 2", "Marks - 2", "Points: 2", "[2 marks]", "(2 marks)", "[2 points]"
  const marksRegex = /(?:Marks?|Points?)\s*[:\=\-]?\s*(\d+(?:\.\d+)?)|\[\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\s*\]|\(\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\s*\)/i;

  // Pattern for Explanation:
  // "Explanation: ...", "Exp: ..."
  const expRegex = /^\s*(?:Explanation|Exp|Rationale)\s*[:\=\-]\s*(.*)$/i;

  const finalizeCurrentQuestion = () => {
    if (!currentQ) return;

    if (currentOption) {
      currentOptions.push(currentOption);
      currentOption = null;
    }

    const qText = (currentQ.questionText || '').trim();
    const opts = [...currentOptions];
    const ans = (currentQ.correctAnswer || '').trim().toUpperCase();
    const marks = currentQ.marks !== undefined ? currentQ.marks : 1;

    let hasError = false;
    let errorMessage = '';

    if (!qText) {
      hasError = true;
      errorMessage = 'Question text is empty.';
    } else if (opts.length < 2) {
      hasError = true;
      errorMessage = `Insufficient options detected (${opts.length} found, minimum 2 required).`;
    } else if (!ans) {
      hasError = true;
      errorMessage = 'Correct answer was not specified (e.g. "Answer: A").';
    } else if (!opts.some(o => o.key.toUpperCase() === ans)) {
      hasError = true;
      errorMessage = `Correct answer "${ans}" does not match any detected option (${opts.map(o => o.key).join(', ')}).`;
    }

    questions.push({
      id: crypto.randomUUID ? crypto.randomUUID() : 'q_' + Math.random().toString(36).substring(2, 9),
      number: currentQ.number || questions.length + 1,
      questionText: qText,
      options: opts,
      correctAnswer: ans,
      marks: Math.max(1, Math.round(marks)),
      explanation: currentQ.explanation,
      hasError,
      errorMessage,
    });

    currentQ = null;
    currentOptions = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      // Empty line can mean separation
      continue;
    }

    // Check Question Start
    const qMatch = line.match(qStartRegex);
    if (qMatch) {
      finalizeCurrentQuestion();
      questionCounter++;
      const qNum = parseInt(qMatch[1], 10) || questionCounter;
      const initialText = qMatch[2] || '';
      currentQ = {
        number: qNum,
        questionText: initialText,
        marks: 1,
      };
      readingQuestionText = true;
      continue;
    }

    // If we are currently inside a question
    if (currentQ) {
      // Check Answer line
      const ansMatch = line.match(ansRegex);
      if (ansMatch) {
        if (currentOption) {
          currentOptions.push(currentOption);
          currentOption = null;
        }
        currentQ.correctAnswer = ansMatch[1].toUpperCase();
        readingQuestionText = false;

        // Check if marks are on the same line, e.g. "Answer: A | Marks: 2"
        const mInline = line.match(marksRegex);
        if (mInline) {
          const mVal = parseFloat(mInline[1] || mInline[2] || mInline[3]);
          if (!isNaN(mVal)) currentQ.marks = mVal;
        }
        continue;
      }

      // Check Marks line
      const marksMatch = line.match(marksRegex);
      if (marksMatch && (line.toLowerCase().startsWith('mark') || line.toLowerCase().startsWith('point') || line.startsWith('[') || line.startsWith('('))) {
        const mVal = parseFloat(marksMatch[1] || marksMatch[2] || marksMatch[3]);
        if (!isNaN(mVal)) {
          currentQ.marks = mVal;
          continue;
        }
      }

      // Check Explanation line
      const expMatch = line.match(expRegex);
      if (expMatch) {
        currentQ.explanation = expMatch[1];
        continue;
      }

      // Check Option line
      const optMatch = line.match(optStartRegex);
      if (optMatch) {
        if (currentOption) {
          currentOptions.push(currentOption);
        }
        const optKey = (optMatch[1] || optMatch[2]).toUpperCase();
        const optText = optMatch[3] || '';
        currentOption = {
          key: optKey,
          text: optText,
        };
        readingQuestionText = false;
        continue;
      }

      // If we are still reading the question text before any options
      if (readingQuestionText && currentOptions.length === 0 && !currentOption) {
        currentQ.questionText = (currentQ.questionText ? currentQ.questionText + ' ' : '') + line;
        continue;
      }

      // If we are continuing an option text
      if (currentOption) {
        currentOption.text = (currentOption.text ? currentOption.text + ' ' : '') + line;
        continue;
      }
    }
  }

  finalizeCurrentQuestion();

  const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 1), 0);
  const errorCount = questions.filter(q => q.hasError).length;

  return {
    questions,
    totalQuestions: questions.length,
    totalMarks,
    hasErrors: errorCount > 0,
    errorCount,
  };
}

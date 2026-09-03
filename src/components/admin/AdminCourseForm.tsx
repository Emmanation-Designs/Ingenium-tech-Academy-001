import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, UploadCloud, Info, Check, 
  Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, X 
} from 'lucide-react';
import { Course, CourseCategory } from '../../types';

interface AdminCourseFormProps {
  initialCourse?: Course | null;
  categories: CourseCategory[];
  onBack: () => void;
  onSubmit: (formData: {
    title: string;
    short_description: string;
    description: string;
    category_id: string;
    category: string;
    duration: string;
    training_mode: string;
    status: 'draft' | 'published' | 'archived';
    usd_price: number;
    ngn_price: number;
    eur_price: number;
    heroFile: File | null;
    removeImage: boolean;
  }) => Promise<void>;
  onCreateCategoryInline?: (name: string) => Promise<CourseCategory>;
}

export const AdminCourseForm: React.FC<AdminCourseFormProps> = ({
  initialCourse,
  categories,
  onBack,
  onSubmit,
  onCreateCategoryInline
}) => {
  const isEditing = !!initialCourse;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [currentStep, setCurrentStep] = useState<'details' | 'pricing'>('details');
  const [title, setTitle] = useState(initialCourse?.title || '');
  const [shortDescription, setShortDescription] = useState(initialCourse?.short_description || '');
  const [description, setDescription] = useState(initialCourse?.description || '');
  const [categoryId, setCategoryId] = useState(initialCourse?.category_id || categories[0]?.id || '');
  const [duration, setDuration] = useState(initialCourse?.duration || '8 Weeks');
  const [trainingMode, setTrainingMode] = useState(initialCourse?.training_mode || 'online');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    initialCourse?.status === 'archived' ? 'archived' : (initialCourse?.is_published ? 'published' : 'draft')
  );

  // Pricing states
  const [usdPrice, setUsdPrice] = useState<number>(initialCourse?.pricing?.usd_price ?? 400);
  const [ngnPrice, setNgnPrice] = useState<number>(initialCourse?.pricing?.ngn_price ?? 200000);
  const [eurPrice, setEurPrice] = useState<number>(initialCourse?.pricing?.eur_price ?? 400);

  // Image states
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string>(initialCourse?.image_url || '');
  const [removeImage, setRemoveImage] = useState(false);

  // Inline Category modal
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be less than 5MB');
      return;
    }

    setHeroFile(file);
    setHeroPreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    setHeroFile(null);
    setHeroPreview('');
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim() || !onCreateCategoryInline) return;
    try {
      const created = await onCreateCategoryInline(newCatName.trim());
      setCategoryId(created.id);
      setNewCatName('');
      setShowNewCatInput(false);
    } catch (e: any) {
      alert('Error creating category: ' + e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Course title is required.');
      setCurrentStep('details');
      return;
    }

    const selectedCat = categories.find(c => c.id === categoryId);
    const categoryName = selectedCat?.name || 'Data Science';

    setSaving(true);
    setErrorMsg(null);
    try {
      await onSubmit({
        title: title.trim(),
        short_description: shortDescription.trim(),
        description: description.trim(),
        category_id: categoryId,
        category: categoryName,
        duration: duration.trim(),
        training_mode: trainingMode,
        status,
        usd_price: Number(usdPrice || 0),
        ngn_price: Number(ngnPrice || 0),
        eur_price: Number(eurPrice || 0),
        heroFile,
        removeImage
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-24 max-w-xl mx-auto">
      {/* Header with Back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-black text-gray-950">
            {isEditing ? 'Edit Course' : (currentStep === 'details' ? 'Create Course' : 'Pricing')}
          </h2>
        </div>

        {/* Step toggler */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setCurrentStep('details')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              currentStep === 'details' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep('pricing')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              currentStep === 'pricing' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Pricing
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* STEP 1: COURSE DETAILS */}
        {currentStep === 'details' && (
          <div className="space-y-4">
            {/* Course Image Upload Box */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-2">
                Course Image
              </label>

              {heroPreview ? (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 group">
                  <img
                    src={heroPreview}
                    alt="Course Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-lg shadow-sm hover:bg-gray-100 cursor-pointer"
                    >
                      Change image
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-red-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 px-4 border-2 border-dashed border-gray-200 hover:border-[#00B074] bg-gray-50/60 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                >
                  <div className="w-11 h-11 rounded-full bg-[#EAFBF3] text-[#00B074] flex items-center justify-center mb-2">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-800">
                    Upload course image
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    JPG, PNG or WEBP (Max. 5MB)
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* Course Title */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                Course Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Analysis with Excel"
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00B074] transition-all"
              />
            </div>

            {/* Short Description */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                Short Description
              </label>
              <input
                type="text"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="A short summary about the course"
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00B074] transition-all"
              />
            </div>

            {/* Full Description with Mock Toolbar */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                Full Description
              </label>
              <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#00B074] transition-all bg-white">
                {/* Mini Formatting Toolbar */}
                <div className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                  <button type="button" className="p-1 hover:bg-gray-200 rounded cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1 hover:bg-gray-200 rounded cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1 hover:bg-gray-200 rounded cursor-pointer"><Underline className="w-3.5 h-3.5" /></button>
                  <div className="w-px h-3 bg-gray-300 mx-1" />
                  <button type="button" className="p-1 hover:bg-gray-200 rounded cursor-pointer"><List className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1 hover:bg-gray-200 rounded cursor-pointer"><ListOrdered className="w-3.5 h-3.5" /></button>
                  <button type="button" className="p-1 hover:bg-gray-200 rounded cursor-pointer"><LinkIcon className="w-3.5 h-3.5" /></button>
                </div>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write full course description..."
                  className="w-full px-3.5 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none resize-y"
                />
              </div>
            </div>

            {/* 2-Column: Category & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-800">Category</label>
                  {onCreateCategoryInline && (
                    <button
                      type="button"
                      onClick={() => setShowNewCatInput(!showNewCatInput)}
                      className="text-[10px] text-[#00B074] font-semibold hover:underline cursor-pointer"
                    >
                      + New
                    </button>
                  )}
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#00B074] transition-all"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                  {categories.length === 0 && (
                    <option value="">Select category</option>
                  )}
                </select>

                {showNewCatInput && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-xl border border-gray-200 flex gap-1.5">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Category name"
                      className="flex-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCategory}
                      className="px-2.5 py-1 bg-[#00B074] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  Duration
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 8 Weeks"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#00B074] transition-all"
                />
              </div>
            </div>

            {/* Training Mode */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                Training Mode
              </label>
              <select
                value={trainingMode}
                onChange={(e) => setTrainingMode(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#00B074] transition-all"
              >
                <option value="online">Live Online</option>
                <option value="self-paced">Self-Paced</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            {/* Next Button */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => setCurrentStep('pricing')}
                className="w-full py-3 bg-[#00B074] hover:bg-[#00905D] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Next: Set Pricing →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PRICING & PUBLISH */}
        {currentStep === 'pricing' && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="p-3.5 bg-[#EAFBF3] rounded-2xl border border-[#00B074]/20 flex items-start gap-3">
              <Info className="w-5 h-5 text-[#00B074] shrink-0 mt-0.5" />
              <p className="text-xs text-gray-800 leading-relaxed font-medium">
                Set the price for this course in different currencies. Students will see the price based on their country.
              </p>
            </div>

            {/* USD Price (Default) */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                USD Price (Default)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  value={usdPrice}
                  onChange={(e) => setUsdPrice(Number(e.target.value))}
                  placeholder="400"
                  className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold focus:outline-none focus:border-[#00B074] transition-all"
                />
              </div>
            </div>

            {/* NGN Price (Nigeria) */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                NGN Price (Nigeria)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                  ₦
                </span>
                <input
                  type="number"
                  min="0"
                  value={ngnPrice}
                  onChange={(e) => setNgnPrice(Number(e.target.value))}
                  placeholder="200,000"
                  className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold focus:outline-none focus:border-[#00B074] transition-all"
                />
              </div>
            </div>

            {/* EUR Price (Euro Countries) */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1.5">
                EUR Price (Euro Countries)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                  €
                </span>
                <input
                  type="number"
                  min="0"
                  value={eurPrice}
                  onChange={(e) => setEurPrice(Number(e.target.value))}
                  placeholder="400"
                  className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 font-semibold focus:outline-none focus:border-[#00B074] transition-all"
                />
              </div>
            </div>

            {/* Course Status Segmented Control */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-2">
                Course Status
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200">
                {(['draft', 'published', 'archived'] as const).map(s => {
                  const isActive = status === s;
                  const label = s.charAt(0).toUpperCase() + s.slice(1);
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#00B074] text-white shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentStep('details')}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                ← Back
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-[#00B074] hover:bg-[#00905D] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span>Saving to Supabase...</span>
                ) : (
                  <span>{isEditing ? 'Save Changes' : 'Create Course'}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

import React, { useState } from 'react';
import { Layers, Plus, Folder, Check } from 'lucide-react';
import { CourseCategory, Course } from '../../types';

interface AdminCategoriesProps {
  categories: CourseCategory[];
  courses: Course[];
  onCreateCategory: (name: string, file?: File | null) => Promise<void>;
}

export const AdminCategories: React.FC<AdminCategoriesProps> = ({
  categories,
  courses,
  onCreateCategory
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreateCategory(name.trim(), file);
      setName('');
      setFile(null);
      setShowAdd(false);
    } catch (e: any) {
      alert('Error creating category: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-950">Course Categories</h2>
          <p className="text-xs text-gray-500 font-medium">Manage academic disciplines</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1.5 bg-[#00B074] hover:bg-[#00905D] text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-gray-900">New Category</h3>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Artificial Intelligence"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#00B074]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#00B074] text-white text-xs font-bold rounded-xl disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Save Category'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {categories.map(cat => {
          const courseCount = courses.filter(c => c.category_id === cat.id || c.category === cat.name).length;
          return (
            <div
              key={cat.id}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EAFBF3] text-[#00B074] flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-950">{cat.name}</h4>
                  <p className="text-[11px] text-gray-400 font-medium">{courseCount} {courseCount === 1 ? 'course' : 'courses'}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAFBF3] text-[#00B074]">
                Active
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

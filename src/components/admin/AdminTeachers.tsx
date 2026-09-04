import React, { useState } from 'react';
import { 
  GraduationCap, Mail, Plus, Copy, Check, RefreshCw, 
  Trash2, Link2, BookOpen, Clock, X, AlertCircle, Users, ChevronRight, UserCheck
} from 'lucide-react';
import { Profile, TeacherInvitation, TeacherCourseAssignment, Course, CourseSchedule } from '../../types';

interface AdminTeachersProps {
  teachers: Profile[];
  invitations: TeacherInvitation[];
  assignments: TeacherCourseAssignment[];
  courses: Course[];
  schedules: CourseSchedule[];
  currentUser: Profile;
  onCreateInvitation: (email: string) => Promise<TeacherInvitation>;
  onResendInvitation: (id: string) => Promise<void>;
  onRevokeInvitation: (id: string) => Promise<void>;
  onAssignTeacher: (teacherId: string, courseId: string, scheduleId?: string) => Promise<void>;
  onRemoveAssignment: (assignmentId: string) => Promise<void>;
  onRefresh: () => void;
}

export const AdminTeachers: React.FC<AdminTeachersProps> = ({
  teachers,
  invitations,
  assignments,
  courses,
  schedules,
  currentUser,
  onCreateInvitation,
  onResendInvitation,
  onRevokeInvitation,
  onAssignTeacher,
  onRemoveAssignment,
  onRefresh
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'teachers' | 'invitations'>('teachers');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<TeacherInvitation | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Selected teacher for assignment drawer/modal
  const [selectedTeacher, setSelectedTeacher] = useState<Profile | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const getInviteUrl = (token: string): string => {
    return `${window.location.origin}/teacher/invite/${token}`;
  };

  const handleCopyLink = async (token: string) => {
    const url = getInviteUrl(token);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2500);
    } catch (e) {
      console.error('Failed to copy link', e);
    }
  };

  const handleCreateInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteError(null);
    setIsSubmittingInvite(true);

    try {
      const inv = await onCreateInvitation(inviteEmail.trim().toLowerCase());
      setGeneratedInvite(inv);
      setInviteEmail('');
      onRefresh();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create teacher invitation.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !selectedCourseId) return;
    setAssignmentError(null);
    setIsAssigning(true);

    try {
      await onAssignTeacher(selectedTeacher.id, selectedCourseId, selectedScheduleId || undefined);
      setSelectedCourseId('');
      setSelectedScheduleId('');
      onRefresh();
    } catch (err: any) {
      setAssignmentError(err.message || 'Failed to assign course.');
    } finally {
      setIsAssigning(false);
    }
  };

  const pendingInvitations = invitations.filter(i => i.status === 'pending');
  const acceptedInvitations = invitations.filter(i => i.status === 'accepted');

  // Available schedules for selected course in assign modal
  const availableSchedules = schedules.filter(s => s.course_id === selectedCourseId && s.is_active);

  return (
    <div className="space-y-6 pb-20 font-sans">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-950">Teacher Management</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
              {teachers.length} Active
            </span>
            {pendingInvitations.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200">
                {pendingInvitations.length} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Invite verified instructors, manage invitations, and assign courses & live cohorts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setGeneratedInvite(null);
              setInviteError(null);
              setIsInviteModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Invite Teacher</span>
          </button>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('teachers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'teachers'
              ? 'bg-[#0A9D8F] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:text-gray-950 border border-gray-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Active Teachers ({teachers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('invitations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'invitations'
              ? 'bg-[#0A9D8F] text-white shadow-xs'
              : 'bg-white text-gray-600 hover:text-gray-950 border border-gray-100'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Invitations ({invitations.length})</span>
          {pendingInvitations.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeSubTab === 'invitations' ? 'bg-white text-[#0A9D8F]' : 'bg-[#E6F5F4] text-[#0A9D8F]'
            }`}>
              {pendingInvitations.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ACTIVE TEACHERS */}
      {activeSubTab === 'teachers' && (
        <div className="space-y-3">
          {teachers.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-gray-100 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center mx-auto">
                <GraduationCap className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-sm font-bold text-gray-950">No Teachers Registered Yet</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Teachers cannot register publicly. Generate an invitation link bound to the teacher's email address to get started.
              </p>
              <button
                type="button"
                onClick={() => {
                  setGeneratedInvite(null);
                  setIsInviteModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Invite First Teacher</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {teachers.map(teacher => {
                const teacherAssignments = assignments.filter(a => a.teacher_id === teacher.id);
                return (
                  <div 
                    key={teacher.id}
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between hover:border-gray-200 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#0A9D8F] text-white flex items-center justify-center font-bold text-sm">
                            {teacher.full_name?.charAt(0)?.toUpperCase() || 'T'}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-gray-950">{teacher.full_name || 'Instructor'}</h4>
                            <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span>{teacher.email}</span>
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                          Active Teacher
                        </span>
                      </div>

                      {/* Info pills */}
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                          {teacher.timezone || 'Africa/Lagos'}
                        </span>
                        {teacher.phone && (
                          <span className="bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                            {teacher.phone}
                          </span>
                        )}
                      </div>

                      {/* Assigned Courses snippet */}
                      <div className="pt-2 border-t border-gray-100 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-gray-700">Assigned Cohorts:</span>
                          <span className="font-bold text-[#0A9D8F]">{teacherAssignments.length}</span>
                        </div>
                        {teacherAssignments.length === 0 ? (
                          <p className="text-[11px] text-gray-400 italic">No courses currently assigned</p>
                        ) : (
                          <div className="space-y-1">
                            {teacherAssignments.slice(0, 3).map(a => (
                              <div key={a.id} className="text-[11px] bg-gray-50 p-2 rounded-lg flex items-center justify-between">
                                <div>
                                  <span className="font-semibold text-gray-900">{a.course_title || 'Course'}</span>
                                  {a.schedule_label && (
                                    <span className="text-gray-500 text-[10px] ml-1.5 font-normal">({a.schedule_label})</span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {teacherAssignments.length > 3 && (
                              <p className="text-[10px] text-gray-400 font-semibold pl-1">
                                +{teacherAssignments.length - 3} more assigned classes
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeacher(teacher);
                          setSelectedCourseId('');
                          setSelectedScheduleId('');
                          setAssignmentError(null);
                        }}
                        className="flex items-center gap-1 text-xs font-bold text-[#0A9D8F] hover:text-[#0A9D8F]/80 cursor-pointer"
                      >
                        <span>Manage Classes</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVITATIONS */}
      {activeSubTab === 'invitations' && (
        <div className="space-y-3">
          {invitations.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-gray-100 text-center space-y-3">
              <Mail className="w-8 h-8 text-gray-400 mx-auto" />
              <h3 className="text-sm font-bold text-gray-950">No Invitations Sent</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Generate an invitation link to onboard teachers. Invitations remain valid for 7 days.
              </p>
              <button
                type="button"
                onClick={() => {
                  setGeneratedInvite(null);
                  setIsInviteModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Create Invitation</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {invitations.map(inv => {
                const isPending = inv.status === 'pending';
                const isAccepted = inv.status === 'accepted';
                const isRevoked = inv.status === 'revoked';
                const isExpired = inv.status === 'expired';

                return (
                  <div
                    key={inv.id}
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-950">{inv.invited_email}</span>
                        {isPending && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                            Pending Acceptance
                          </span>
                        )}
                        {isAccepted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-950 text-white flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Accepted</span>
                          </span>
                        )}
                        {isRevoked && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                            Revoked
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                            Expired
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        <span>Created: {new Date(inv.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Expires: {new Date(inv.expires_at).toLocaleDateString()}</span>
                        {isAccepted && inv.accepted_at && (
                          <>
                            <span>•</span>
                            <span className="text-[#0A9D8F] font-medium">
                              Claimed on {new Date(inv.accepted_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(inv.token)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:text-gray-950 hover:bg-gray-50 text-xs font-bold transition-all cursor-pointer"
                          >
                            {copiedToken === inv.token ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#0A9D8F]" />
                                <span className="text-[#0A9D8F]">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onResendInvitation(inv.id)}
                            title="Regenerate token and extend expiration"
                            className="p-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-950 hover:bg-gray-50 transition-all cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onRevokeInvitation(inv.id)}
                            title="Revoke invitation"
                            className="p-1.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-950 hover:bg-gray-50 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {(isRevoked || isExpired) && (
                        <button
                          type="button"
                          onClick={() => onResendInvitation(inv.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Re-invite</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE INVITATION */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-950">Invite Teacher</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setGeneratedInvite(null);
                  setInviteError(null);
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!generatedInvite ? (
              <form onSubmit={handleCreateInviteSubmit} className="space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Enter the teacher's email. An invitation link strictly bound to this address will be generated. The instructor must sign up using this exact email.
                </p>

                {inviteError && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1">
                    Teacher Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="teacher@ingeniumacademy.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInvite || !inviteEmail.trim()}
                    className="px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingInvite ? 'Generating...' : 'Generate Invitation'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 bg-[#E6F5F4] rounded-2xl border border-[#0A9D8F]/20 text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-[#0A9D8F] text-white flex items-center justify-center mx-auto">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <h4 className="text-xs font-bold text-[#0A9D8F]">Invitation Created Successfully</h4>
                  <p className="text-[11px] text-gray-600">
                    Bound to <strong className="text-gray-950">{generatedInvite.invited_email}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1">
                    Invitation URL
                  </label>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 break-all text-[11px] text-gray-800 font-mono">
                    {getInviteUrl(generatedInvite.token)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(generatedInvite.token)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs cursor-pointer"
                  >
                    {copiedToken === generatedInvite.token ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Invitation Link</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setGeneratedInvite(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGE TEACHER ASSIGNMENTS */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950">Assigned Classes</h3>
                <p className="text-xs text-gray-500">
                  {selectedTeacher.full_name} ({selectedTeacher.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeacher(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* Currently assigned classes */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 mb-2">Current Class Assignments</h4>
                {assignments.filter(a => a.teacher_id === selectedTeacher.id).length === 0 ? (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl">
                    No classes currently assigned to this teacher.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignments
                      .filter(a => a.teacher_id === selectedTeacher.id)
                      .map(a => (
                        <div
                          key={a.id}
                          className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between"
                        >
                          <div>
                            <h5 className="text-xs font-bold text-gray-950">{a.course_title || 'Course'}</h5>
                            <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span>{a.schedule_label || 'All cohorts'}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveAssignment(a.id)}
                            className="text-xs font-bold text-gray-500 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Remove assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Assign new course/schedule form */}
              <form onSubmit={handleAssignSubmit} className="pt-3 border-t border-gray-100 space-y-3">
                <h4 className="text-xs font-bold text-gray-900">Assign New Course or Schedule</h4>

                {assignmentError && (
                  <div className="p-2.5 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs">
                    {assignmentError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Select Course *
                  </label>
                  <select
                    required
                    value={selectedCourseId}
                    onChange={e => {
                      setSelectedCourseId(e.target.value);
                      setSelectedScheduleId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                  >
                    <option value="">-- Choose Course --</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCourseId && (
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      Select Cohort / Schedule (Optional)
                    </label>
                    <select
                      value={selectedScheduleId}
                      onChange={e => setSelectedScheduleId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                    >
                      <option value="">All Cohorts for this Course</option>
                      {availableSchedules.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({s.day_of_week} {s.start_time} - {s.end_time})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Assigning to a specific schedule makes this teacher the primary tutor for that cohort.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isAssigning || !selectedCourseId}
                    className="w-full py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isAssigning ? 'Assigning...' : 'Assign Class to Teacher'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

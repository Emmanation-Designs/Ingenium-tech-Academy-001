import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase environment variables are missing on the server.');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
}

export default async function sendNotificationHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      senderId,
      senderRole,
      senderName,
      title,
      message,
      link,
      targetAudience, // 'all' | 'students' | 'teachers' | 'course_students' | 'specific_users'
      courseId,
      recipientIds,
      category = 'announcement'
    } = req.body;

    if (!senderId || !senderRole || !title?.trim() || !message?.trim()) {
      return res.status(400).json({ 
        error: 'Missing required fields: senderId, senderRole, title, and message are required.' 
      });
    }

    const supabase = getSupabaseAdmin();

    // 1. Resolve recipients based on sender role and target audience
    let resolvedRecipientIds: string[] = [];

    if (senderRole === 'teacher') {
      // TEACHER RULES: Can only send to their students!
      // Step A: Find teacher's assigned courses
      const { data: assignments, error: assignErr } = await supabase
        .from('teacher_course_assignments')
        .select('course_id')
        .eq('teacher_id', senderId);

      if (assignErr) {
        console.error('[Notification Server] Error fetching teacher assignments:', assignErr);
        return res.status(500).json({ error: 'Failed to verify teacher course assignments.' });
      }

      const assignedCourseIds = (assignments || []).map((a: any) => a.course_id);

      if (assignedCourseIds.length === 0) {
        return res.status(400).json({ 
          error: 'You do not have any assigned courses yet. You can only send messages to students enrolled in your courses.' 
        });
      }

      // If courseId specified, verify teacher teaches it
      const targetCourseIds = courseId 
        ? assignedCourseIds.filter((id: string) => id === courseId)
        : assignedCourseIds;

      if (courseId && targetCourseIds.length === 0) {
        return res.status(403).json({ 
          error: 'Unauthorized: You are not assigned to instruct this course.' 
        });
      }

      // Step B: Fetch students enrolled in these courses
      // We check both enrollments table and approved course_selections
      const [enrollmentsRes, selectionsRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('user_id')
          .in('course_id', targetCourseIds),
        supabase
          .from('course_selections')
          .select('user_id')
          .in('course_id', targetCourseIds)
          .in('status', ['approved', 'enrolled', 'completed'])
      ]);

      const studentIdsSet = new Set<string>();
      (enrollmentsRes.data || []).forEach((row: any) => {
        if (row.user_id) studentIdsSet.add(row.user_id);
      });
      (selectionsRes.data || []).forEach((row: any) => {
        if (row.user_id) studentIdsSet.add(row.user_id);
      });

      const allowedStudentIds = Array.from(studentIdsSet);

      if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
        // Filter requested recipientIds against allowed student IDs
        resolvedRecipientIds = recipientIds.filter(id => allowedStudentIds.includes(id));
      } else {
        resolvedRecipientIds = allowedStudentIds;
      }

      if (resolvedRecipientIds.length === 0) {
        return res.status(400).json({ 
          error: 'No active enrolled students found for the selected course(s).' 
        });
      }

    } else if (senderRole === 'admin') {
      // ADMIN RULES: Can broadcast to all users, all students, all teachers, students in a specific course, or specific users
      if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
        resolvedRecipientIds = recipientIds;
      } else if (targetAudience === 'course_students' || targetAudience === 'course' || courseId) {
        if (!courseId) {
          return res.status(400).json({ error: 'Please select a course to target its enrolled students.' });
        }
        // Fetch students enrolled in this course from both enrollments and course_selections
        const [enrollmentsRes, selectionsRes] = await Promise.all([
          supabase
            .from('enrollments')
            .select('student_id')
            .eq('course_id', courseId),
          supabase
            .from('course_selections')
            .select('student_id')
            .eq('course_id', courseId)
            .in('status', ['approved', 'enrolled', 'completed', 'paid', 'active'])
        ]);

        const studentIdsSet = new Set<string>();
        (enrollmentsRes.data || []).forEach((row: any) => {
          if (row.student_id) studentIdsSet.add(row.student_id);
          else if (row.user_id) studentIdsSet.add(row.user_id);
        });
        (selectionsRes.data || []).forEach((row: any) => {
          if (row.student_id) studentIdsSet.add(row.student_id);
          else if (row.user_id) studentIdsSet.add(row.user_id);
        });

        resolvedRecipientIds = Array.from(studentIdsSet);

        if (resolvedRecipientIds.length === 0) {
          return res.status(400).json({ 
            error: 'No active enrolled students found for the selected course.' 
          });
        }
      } else if (targetAudience === 'students') {
        const { data: students, error: stdErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'student');
        if (stdErr) throw stdErr;
        resolvedRecipientIds = (students || []).map((s: any) => s.id);
      } else if (targetAudience === 'teachers') {
        const { data: teachers, error: tchErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'teacher');
        if (tchErr) throw tchErr;
        resolvedRecipientIds = (teachers || []).map((t: any) => t.id);
      } else {
        // targetAudience === 'all'
        const { data: users, error: allErr } = await supabase
          .from('profiles')
          .select('id');
        if (allErr) throw allErr;
        resolvedRecipientIds = (users || []).map((u: any) => u.id);
      }
    } else {
      return res.status(403).json({ error: 'Unauthorized sender role.' });
    }

    if (resolvedRecipientIds.length === 0) {
      return res.status(400).json({ error: 'No recipients matched the target audience.' });
    }

    // 2. Format message and link
    const cleanTitle = title.trim();
    let cleanMessage = message.trim();
    const cleanLink = link?.trim();

    // If an action link was provided and isn't already inside the message text, append it cleanly
    if (cleanLink && !cleanMessage.includes(cleanLink)) {
      cleanMessage = `${cleanMessage}\n\nLink: ${cleanLink}`;
    }

    // 3. Insert notification records for all recipients
    // Attempt with extended fields first; fallback to basic fields if columns don't exist yet
    const fullRecords = resolvedRecipientIds.map((userId: string) => ({
      user_id: userId,
      title: cleanTitle,
      message: cleanMessage,
      link: cleanLink || null,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      category,
      is_read: false
    }));

    let { error: insertError } = await supabase
      .from('notifications')
      .insert(fullRecords);

    // If error is due to missing columns in notifications schema, fallback to baseline columns
    if (insertError) {
      console.warn('[Notification Server] Insert with extended columns failed, falling back to core columns:', insertError.message);
      const baselineRecords = resolvedRecipientIds.map((userId: string) => ({
        user_id: userId,
        title: cleanTitle,
        message: cleanMessage,
        is_read: false
      }));

      const { error: fallbackError } = await supabase
        .from('notifications')
        .insert(baselineRecords);

      if (fallbackError) {
        console.error('[Notification Server] Error inserting notifications:', fallbackError);
        return res.status(500).json({ error: fallbackError.message });
      }
    }

    return res.status(200).json({
      success: true,
      deliveredCount: resolvedRecipientIds.length,
      message: `Notification successfully sent to ${resolvedRecipientIds.length} recipient${resolvedRecipientIds.length > 1 ? 's' : ''}.`
    });

  } catch (err: any) {
    console.error('[Notification Server] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error while sending notification.' });
  }
}

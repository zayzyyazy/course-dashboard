/** Course-scoped API payload fields for vault + AI. */
export function coursePayload(course) {
  if (!course) return {};
  return {
    courseId: course.id,
    courseName: course.name,
    courseStorageKey: course.storageKey || course.name
  };
}

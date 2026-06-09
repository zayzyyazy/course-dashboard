const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  storeGetAll: () => ipcRenderer.invoke('store:getAll'),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

  openPdf: () => ipcRenderer.invoke('dialog:openPdf'),
  openExercisePdf: () => ipcRenderer.invoke('dialog:openExercisePdf'),
  openReferenceImage: () => ipcRenderer.invoke('dialog:openReferenceImage'),
  openSettings: () => ipcRenderer.invoke('nav:settings'),

  getCourses: () => ipcRenderer.invoke('courses:list'),
  getDashboardOverview: () => ipcRenderer.invoke('dashboard:getOverview'),
  askDashboard: (data) => ipcRenderer.invoke('dashboard:ask', data),
  createCourse: (data) => ipcRenderer.invoke('courses:create', data),
  reorderCourses: (courseIds) => ipcRenderer.invoke('courses:reorder', { courseIds }),
  deleteCourse: (data) => ipcRenderer.invoke('courses:delete', data),
  getCourseFolderPath: (courseStorageKey) => ipcRenderer.invoke('courses:getFolderPath', courseStorageKey),
  getCourseSettings: (courseId) => ipcRenderer.invoke('courses:getSettings', courseId),
  saveCourseSettings: (data) => ipcRenderer.invoke('courses:saveSettings', data),

  getCourseLectures: (courseStorageKey) => ipcRenderer.invoke('course:getLectures', courseStorageKey),
  reorderLectures: (data) => ipcRenderer.invoke('course:reorderLectures', data),
  deleteLecture: (data) => ipcRenderer.invoke('course:deleteLecture', data),
  promoteTopic: (data) => ipcRenderer.invoke('course:promoteTopic', data),
  getLectureFolderPath: (data) => ipcRenderer.invoke('lecture:getFolderPath', data),
  getLecture: (lecturePath) => ipcRenderer.invoke('lecture:get', lecturePath),

  processPdf: (data) => ipcRenderer.invoke('lecture:processPdf', data),
  attachExercisePdf: (data) => ipcRenderer.invoke('lecture:attachExercisePdf', data),
  onProcessStatus: (cb) => {
    const fn = (_, status) => cb(status);
    ipcRenderer.on('process:status', fn);
    return () => ipcRenderer.removeListener('process:status', fn);
  },

  markLectureOpened: (lecturePath) => ipcRenderer.invoke('lecture:markOpened', lecturePath),
  markRewindRead: (data) => ipcRenderer.invoke('lecture:markRewindRead', data),
  markTopicStudied: (data) => ipcRenderer.invoke('lecture:markTopicStudied', data),
  toggleSubtopicStudied: (data) => ipcRenderer.invoke('lecture:toggleSubtopicStudied', data),
  cycleSubtopicConfidence: (data) => ipcRenderer.invoke('lecture:cycleSubtopicConfidence', data),
  listLectureNotes: (lecturePath) => ipcRenderer.invoke('lecture:listNotes', { lecturePath }),
  saveHighlightNote: (data) => ipcRenderer.invoke('lecture:saveHighlightNote', data),
  autoSaveHighlightNote: (data) => ipcRenderer.invoke('lecture:autoSaveHighlightNote', data),
  appendToNoteFromStudy: (data) => ipcRenderer.invoke('lecture:appendToNoteFromStudy', data),
  deleteNoteStudyBlock: (data) => ipcRenderer.invoke('lecture:deleteNoteStudyBlock', data),
  addNoteInlineHighlight: (data) => ipcRenderer.invoke('lecture:addNoteInlineHighlight', data),
  removeNoteInlineHighlight: (data) => ipcRenderer.invoke('lecture:removeNoteInlineHighlight', data),
  deleteLectureNote: (data) => ipcRenderer.invoke('lecture:deleteNote', data),
  updateLectureNote: (data) => ipcRenderer.invoke('lecture:updateNote', data),
  toggleLecturePin: (data) => ipcRenderer.invoke('pins:toggleLecture', data),
  toggleTopicPin: (data) => ipcRenderer.invoke('pins:toggleTopic', data),
  toggleSubtopicPin: (data) => ipcRenderer.invoke('pins:toggleSubtopic', data),
  toggleNotePin: (data) => ipcRenderer.invoke('pins:toggleNote', data),
  listPinsForLecture: (data) => ipcRenderer.invoke('pins:listForLecture', data),
  listAllPins: () => ipcRenderer.invoke('pins:listAll'),
  reorderNotes: (data) => ipcRenderer.invoke('notes:reorder', data),
  mergeNotes: (data) => ipcRenderer.invoke('notes:merge', data),
  rebuildNoteMetadata: (lecturePath, options = {}) =>
    ipcRenderer.invoke('lecture:rebuildNoteMetadata', { lecturePath, ...options }),
  refineNote: (data) => ipcRenderer.invoke('lecture:refineNote', data),
  askTutor: (data) => ipcRenderer.invoke('lecture:ask', data),
  askAboutNote: (data) => ipcRenderer.invoke('lecture:askAboutNote', data),
  askAboutSelection: (data) => ipcRenderer.invoke('lecture:askAboutSelection', data),
  expandTopic: (data) => ipcRenderer.invoke('lecture:expandTopic', data),
  expandSubtopic: (data) => ipcRenderer.invoke('lecture:expandSubtopic', data),
  generateRewind: (data) => ipcRenderer.invoke('lecture:generateRewind', data),

  listLectureReferences: (lecturePath) =>
    ipcRenderer.invoke('lecture:listReferences', { lecturePath }),
  addLectureReference: (data) => ipcRenderer.invoke('lecture:addReference', data),
  updateLectureReference: (data) => ipcRenderer.invoke('lecture:updateReference', data),
  deleteLectureReference: (data) => ipcRenderer.invoke('lecture:deleteReference', data),
  importReferenceImage: (data) => ipcRenderer.invoke('lecture:importReferenceImage', data),
  importReferenceClipboard: (data) => ipcRenderer.invoke('lecture:importReferenceClipboard', data),
  getReferenceAsset: (data) => ipcRenderer.invoke('lecture:getReferenceAsset', data),
  getPageImage: (data) => ipcRenderer.invoke('lecture:getPageImage', data),
  describeReference: (data) => ipcRenderer.invoke('lecture:describeReference', data),
  classifyReferenceText: (data) => ipcRenderer.invoke('lecture:classifyReferenceText', data),
  askAboutReference: (data) => ipcRenderer.invoke('lecture:askAboutReference', data),
  openExternalUrl: (url) => ipcRenderer.invoke('lecture:openExternalUrl', { url }),
  openExerciseCoach: (payload) => ipcRenderer.invoke('practice:openExerciseCoach', payload)
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  storeGetAll: () => ipcRenderer.invoke('store:getAll'),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

  openPdf: () => ipcRenderer.invoke('dialog:openPdf'),
  openSettings: () => ipcRenderer.invoke('nav:settings'),

  getCourses: () => ipcRenderer.invoke('courses:list'),
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
  onProcessStatus: (cb) => {
    const fn = (_, status) => cb(status);
    ipcRenderer.on('process:status', fn);
    return () => ipcRenderer.removeListener('process:status', fn);
  },

  markLectureOpened: (lecturePath) => ipcRenderer.invoke('lecture:markOpened', lecturePath),
  markTopicStudied: (data) => ipcRenderer.invoke('lecture:markTopicStudied', data),
  listLectureNotes: (lecturePath) => ipcRenderer.invoke('lecture:listNotes', { lecturePath }),
  saveHighlightNote: (data) => ipcRenderer.invoke('lecture:saveHighlightNote', data),
  deleteLectureNote: (data) => ipcRenderer.invoke('lecture:deleteNote', data),
  refineNote: (data) => ipcRenderer.invoke('lecture:refineNote', data),
  askTutor: (data) => ipcRenderer.invoke('lecture:ask', data),
  askAboutNote: (data) => ipcRenderer.invoke('lecture:askAboutNote', data),
  expandTopic: (data) => ipcRenderer.invoke('lecture:expandTopic', data)
});

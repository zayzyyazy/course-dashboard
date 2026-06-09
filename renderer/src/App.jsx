import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from './hooks/useStore';
import Sidebar from './components/Sidebar';
import SidebarShell from './components/SidebarShell';
import HomePage from './pages/HomePage';
import CoursePage from './pages/CoursePage';
import LecturePage from './pages/LecturePage';
import TopicPage from './pages/TopicPage';
import SettingsPanel from './pages/SettingsPanel';
import CourseSettingsPage from './pages/CourseSettingsPage';
import { coursePayload } from './utils/courseApi';
import ImportModal from './components/ImportModal';
import ProcessingOverlay from './components/ProcessingOverlay';
import DeleteCourseModal from './components/DeleteCourseModal';
import DeleteLectureModal from './components/DeleteLectureModal';
import Toast from './components/Toast';
import { StudyPinsProvider } from './state/studyPins.jsx';
import StudyPinOverlay from './components/StudyPinOverlay';
import { getMaterialTopics, findExerciseTopic, getExerciseSheets } from './utils/lectureMaterial';
import { useCompactLayout } from './hooks/useCompactLayout';

export default function App() {
  const { state, loading, update } = useStore();
  const [view, setView] = useState('home');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [pendingPdf, setPendingPdf] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deleteFolderPath, setDeleteFolderPath] = useState('');
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [toast, setToast] = useState('');
  const [lectureNotesCount, setLectureNotesCount] = useState(0);
  const [lectureRefreshKey, setLectureRefreshKey] = useState(0);
  const [lectureToDelete, setLectureToDelete] = useState(null);
  const [deleteLectureFolderPath, setDeleteLectureFolderPath] = useState('');
  const [openLectureNotes, setOpenLectureNotes] = useState(false);
  const [pendingOpenNoteId, setPendingOpenNoteId] = useState(null);
  const [returnViewAfterNote, setReturnViewAfterNote] = useState(null);
  const [pendingExerciseNav, setPendingExerciseNav] = useState(null);
  const [pendingFocusSubtopicId, setPendingFocusSubtopicId] = useState(null);
  const [returnLectureTopicId, setReturnLectureTopicId] = useState(null);
  const [lectureContentKey, setLectureContentKey] = useState(0);
  const [materialMode, setMaterialMode] = useState('lecture');
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [dashboardKey, setDashboardKey] = useState(0);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const compact = useCompactLayout();

  useEffect(() => {
    window.api.storeGetAll().then((data) => {
      if (data?.sidebarHidden) setSidebarHidden(true);
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarHidden((prev) => {
      const next = !prev;
      window.api.storeSet('sidebarHidden', next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!compact) return;
    if (view === 'lecture' || view === 'topic') {
      setSidebarHidden(true);
    }
  }, [compact, view, selectedLecture?.path, selectedTopic?.id]);

  useEffect(() => {
    if (!selectedLecture?.path) {
      setLectureNotesCount(0);
      return;
    }
    window.api.listLectureNotes(selectedLecture.path).then((res) => {
      if (res.success) setLectureNotesCount(res.notes?.length || 0);
    });
  }, [selectedLecture?.path, notesRefreshKey]);

  useEffect(() => {
    if (!processing) return;
    const remove = window.api.onProcessStatus((s) => setProcessing((p) => ({ ...p, ...s })));
    return remove;
  }, [Boolean(processing)]);

  const syncCourses = useCallback(async () => {
    const courses = await window.api.getCourses();
    await update('courses', courses);
    return courses;
  }, [update]);

  const handleMoveCourse = useCallback(
    async (courseId, direction) => {
      const ids = state.courses.map((c) => c.id);
      const i = ids.indexOf(courseId);
      if (i < 0) return;
      const j = direction === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      const result = await window.api.reorderCourses(ids);
      if (result.success) await update('courses', result.courses);
    },
    [state.courses, update]
  );

  const handleRequestDeleteCourse = useCallback(async (course) => {
    const folderPath = await window.api.getCourseFolderPath(course.storageKey || course.name);
    setDeleteFolderPath(folderPath || '');
    setCourseToDelete(course);
  }, []);

  const clearCourseSelection = useCallback(
    (deletedId) => {
      if (selectedCourse?.id === deletedId) {
        setSelectedCourse(null);
        setSelectedLecture(null);
        setSelectedTopic(null);
        setView('home');
      }
    },
    [selectedCourse?.id]
  );

  const handleDeleteCourse = useCallback(
    async (deleteFromDisk) => {
      if (!courseToDelete) return { success: false };
      const result = await window.api.deleteCourse({
        courseId: courseToDelete.id,
        deleteFromDisk
      });
      if (result.success) {
        clearCourseSelection(result.deletedCourseId);
        await syncCourses();
        setCourseToDelete(null);
        setDeleteFolderPath('');
        if (result.diskWarning) alert(result.diskWarning);
      }
      return result;
    },
    [courseToDelete, clearCourseSelection, syncCourses]
  );

  const showToast = useCallback((message) => {
    setToast(message);
  }, []);

  const handleRequestDeleteLecture = useCallback(
    async (lecture) => {
      if (!selectedCourse) return;
      const folderPath = await window.api.getLectureFolderPath({
        ...coursePayload(selectedCourse),
        lectureId: lecture.id
      });
      setDeleteLectureFolderPath(folderPath || '');
      setLectureToDelete(lecture);
    },
    [selectedCourse]
  );

  const handleDeleteLecture = useCallback(
    async (deleteFromDisk) => {
      if (!lectureToDelete || !selectedCourse) return { success: false };
      const result = await window.api.deleteLecture({
        ...coursePayload(selectedCourse),
        lectureId: lectureToDelete.id,
        deleteFromDisk
      });
      if (result.success) {
        if (selectedLecture?.id === result.deletedLectureId) {
          setSelectedLecture(null);
          setSelectedTopic(null);
          setView('course');
        }
        setLectureToDelete(null);
        setDeleteLectureFolderPath('');
        setLectureRefreshKey((k) => k + 1);
        showToast(
          deleteFromDisk ? 'Lecture deleted from app and disk' : 'Lecture removed from app (files kept on disk)'
        );
      }
      return result;
    },
    [lectureToDelete, selectedCourse, selectedLecture?.id, showToast]
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleImportPdf = useCallback(async () => {
    if (!state.apiKey) {
      setView('settings');
      return;
    }
    const pdfPath = await window.api.openPdf();
    if (!pdfPath) return;
    setPendingPdf(pdfPath);
    setShowImport(true);
  }, [state.apiKey]);

  const openCourseItemById = useCallback(
    async (itemId) => {
      if (!selectedCourse) return;
      const res = await window.api.getCourseLectures(selectedCourse.storageKey || selectedCourse.name);
      const item = res.lectures?.find((l) => l.id === itemId);
      if (item) {
        setSelectedLecture(item);
        setSelectedTopic(null);
        setView('lecture');
      }
    },
    [selectedCourse]
  );

  const bumpDashboard = useCallback(() => setDashboardKey((k) => k + 1), []);

  const handleDashboardNavigate = useCallback(
    async ({
      courseId,
      lectureId,
      topicId,
      subtopicId,
      materialMode,
      noteId,
      itemType,
      exerciseId: navExerciseId
    }) => {
      const course = state.courses.find((c) => c.id === courseId);
      if (!course) return;
      setSelectedCourse(course);
      if (!lectureId) {
        setSelectedLecture(null);
        setSelectedTopic(null);
        setView('course');
        return;
      }
      const res = await window.api.getCourseLectures(course.storageKey || course.name);
      const lec = res.lectures?.find((l) => l.id === lectureId);
      if (!lec) {
        setView('course');
        return;
      }
      const full = await window.api.getLecture(lec.path);
      const lecture = full || lec;
      const mode = materialMode === 'exercise' ? 'exercise' : 'lecture';
      const exerciseId = navExerciseId || '';

      if (noteId) {
        setSelectedLecture(lecture);
        setSelectedTopic(null);
        setMaterialMode(mode);
        setSelectedExerciseId(mode === 'exercise' ? exerciseId : '');
        setPendingOpenNoteId(noteId);
        setPendingFocusSubtopicId(null);
        setView('lecture');
        return;
      }

      if (topicId) {
        const topics =
          mode === 'exercise'
            ? getMaterialTopics(lecture, 'exercise', exerciseId)
            : lecture.topics || [];
        const topic =
          topics.find((t) => t.id === topicId) ||
          (mode === 'exercise' ? findExerciseTopic(lecture, topicId, exerciseId) : null);
        if (topic) {
          setSelectedLecture(lecture);
          setSelectedTopic(topic);
          setMaterialMode(mode);
          setSelectedExerciseId(mode === 'exercise' ? exerciseId : '');
          setPendingFocusSubtopicId(subtopicId || null);
          setView('topic');
          return;
        }
      }

      setSelectedLecture(lecture);
      setSelectedTopic(null);
      setMaterialMode(itemType === 'promoted' ? 'lecture' : mode);
      setSelectedExerciseId(mode === 'exercise' ? exerciseId : '');
      setView('lecture');
    },
    [state.courses]
  );

  const handlePromoteTopic = useCallback(
    async ({ lecturePath, topicId }) => {
      if (!selectedCourse) return;
      if (!state.apiKey) {
        setView('settings');
        return;
      }
      setProcessing({ title: 'Creating study unit', message: 'Starting…' });
      const result = await window.api.promoteTopic({
        ...coursePayload(selectedCourse),
        lecturePath,
        topicId
      });
      setProcessing(null);
      if (result.success) {
        setLectureRefreshKey((k) => k + 1);
        setSelectedLecture(result.unit);
        setSelectedTopic(null);
        setView('lecture');
        showToast('Study unit created — finer topics and cards generated');
      } else if (result.existingUnit) {
        setSelectedLecture(result.existingUnit);
        setSelectedTopic(null);
        setView('lecture');
        showToast('Study unit already exists for this topic');
      } else {
        alert(result.error || 'Could not create study unit');
      }
    },
    [selectedCourse, state.apiKey, showToast]
  );

  const handleAttachExercise = useCallback(async () => {
    if (!selectedCourse || !selectedLecture?.path) return;
    if (!state.apiKey) {
      setView('settings');
      return;
    }
    const pdfPath = await window.api.openExercisePdf();
    if (!pdfPath) return;
    setProcessing({ title: 'Processing Übung', message: 'Starting…' });
    const result = await window.api.attachExercisePdf({
      pdfPath,
      lecturePath: selectedLecture.path,
      ...coursePayload(selectedCourse)
    });
    setProcessing(null);
    if (result.success) {
      const lec = await window.api.getLecture(selectedLecture.path);
      if (lec) setSelectedLecture(lec);
      setMaterialMode('exercise');
      const sheets = getExerciseSheets(lec);
      setSelectedExerciseId(result.exerciseId || sheets[sheets.length - 1]?.id || sheets[0]?.id || '');
      setLectureContentKey((k) => k + 1);
      showToast(
        sheets.length > 1 ? `Übung ${sheets.length} attached` : 'Übung attached to this lecture'
      );
    } else {
      alert(result.error || 'Could not process exercise PDF');
    }
  }, [selectedCourse, selectedLecture?.path, state.apiKey, showToast]);

  const runProcess = useCallback(
    async (course) => {
      setShowImport(false);
      setProcessing({ title: 'Processing lecture', message: 'Starting…' });
      const result = await window.api.processPdf({
        pdfPath: pendingPdf,
        ...coursePayload(course)
      });
      setProcessing(null);
      setPendingPdf(null);
      if (result.success) {
        setSelectedCourse(course);
        setView('course');
        setSelectedLecture(result.lecture);
        setView('lecture');
      } else {
        alert(result.error || 'Processing failed');
      }
    },
    [pendingPdf]
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <StudyPinsProvider activeLecturePath={selectedLecture?.path || ''}>
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <SidebarShell hidden={sidebarHidden} onToggle={toggleSidebar} compact={compact}>
        <Sidebar
          courses={state.courses}
          selectedCourseId={selectedCourse?.id}
          reorderMode={reorderMode}
          onToggleReorder={() => setReorderMode((v) => !v)}
          onMoveCourse={handleMoveCourse}
          onRequestDeleteCourse={handleRequestDeleteCourse}
          onSelectCourse={(c) => {
            setSelectedCourse(c);
            setSelectedLecture(null);
            setSelectedTopic(null);
            setView('course');
          }}
          onImportPdf={handleImportPdf}
          onOpenSettings={() => setView('settings')}
          onGoHome={() => {
            setView('home');
            setSelectedCourse(null);
            setSelectedLecture(null);
            setSelectedTopic(null);
            setDashboardKey((k) => k + 1);
          }}
        />
      </SidebarShell>

      <main className="flex-1 overflow-hidden relative">
        {view === 'home' && (
          <HomePage
            key={dashboardKey}
            courses={state.courses}
            refreshKey={dashboardKey}
            hasApiKey={Boolean(state.apiKey)}
            onOpenTarget={handleDashboardNavigate}
            onOpenSettings={() => setView('settings')}
            onSelectCourse={(c) => {
              setSelectedCourse(c);
              setView('course');
            }}
            onImportPdf={handleImportPdf}
          />
        )}
        {view === 'course' && (
          <CoursePage
            key={`${selectedCourse?.id}-${lectureRefreshKey}`}
            course={selectedCourse}
            refreshKey={lectureRefreshKey}
            onOpenLecture={(lec) => {
              setSelectedLecture(lec);
              setMaterialMode('lecture');
              setSelectedExerciseId('');
              setView('lecture');
            }}
            onBack={() => setView('home')}
            onOpenSettings={() => setView('courseSettings')}
            onRequestDeleteLecture={handleRequestDeleteLecture}
          />
        )}
        {view === 'courseSettings' && selectedCourse && (
          <CourseSettingsPage
            course={selectedCourse}
            onBack={() => setView('course')}
            onSaved={async (updatedCourse, courses) => {
              setSelectedCourse(updatedCourse);
              if (courses) await update('courses', courses);
              else await syncCourses();
              showToast('Course settings saved');
            }}
          />
        )}
        {view === 'lecture' && (
          <LecturePage
            key={`${selectedLecture?.path}-${notesRefreshKey}-${lectureContentKey}`}
            course={selectedCourse}
            lectureMeta={selectedLecture}
            hasApiKey={Boolean(state.apiKey)}
            materialMode={materialMode}
            exerciseId={selectedExerciseId}
            onMaterialModeChange={(mode) => {
              setMaterialMode(mode);
              if (mode === 'exercise' && selectedLecture) {
                const sheets = getExerciseSheets(selectedLecture);
                if (sheets.length && !selectedExerciseId) {
                  setSelectedExerciseId(sheets[0].id);
                }
              }
            }}
            onExerciseIdChange={setSelectedExerciseId}
            onAttachExercise={handleAttachExercise}
            openNotesView={openLectureNotes}
            onNotesViewConsumed={() => setOpenLectureNotes(false)}
            pendingOpenNoteId={pendingOpenNoteId}
            onPendingNoteConsumed={() => setPendingOpenNoteId(null)}
            returnViewAfterNote={returnViewAfterNote}
            onReturnAfterNote={() => {
              if (returnViewAfterNote === 'topic' && selectedTopic) {
                setView('topic');
              }
              setReturnViewAfterNote(null);
            }}
            onOpenTopic={(lecture, topic, mode, options) => {
              setSelectedLecture(lecture);
              setSelectedTopic(topic);
              setMaterialMode(mode || 'lecture');
              if (options?.exerciseId) setSelectedExerciseId(options.exerciseId);
              setPendingFocusSubtopicId(options?.subtopicId || null);
              setView('topic');
            }}
            onOpenSourceItem={async (sourcePath) => {
              const item = await window.api.getLecture(sourcePath);
              if (item) {
                setSelectedLecture(item);
                setSelectedTopic(null);
                setView('lecture');
              }
            }}
            onOpenPromotedUnit={openCourseItemById}
            onPinsChanged={bumpDashboard}
            onNotify={showToast}
            sidebarHidden={sidebarHidden}
            onToggleSidebar={toggleSidebar}
            onBack={() => setView('course')}
          />
        )}
        {view === 'topic' && selectedTopic && (
          <TopicPage
            course={selectedCourse}
            lecture={selectedLecture}
            topic={selectedTopic}
            materialMode={materialMode}
            exerciseId={selectedExerciseId}
            hasApiKey={Boolean(state.apiKey)}
            notesCount={lectureNotesCount}
            onNoteSaved={() => {
              setNotesRefreshKey((k) => k + 1);
              showToast('Note saved for this topic');
            }}
            onGoToNotes={() => {
              setOpenLectureNotes(true);
              setView('lecture');
            }}
            onOpenSavedNote={(noteId) => {
              setPendingOpenNoteId(noteId);
              setReturnViewAfterNote('topic');
              setView('lecture');
            }}
            onOpenExerciseSubtopic={(link) => {
              if (!link?.exerciseTopicId || !selectedLecture) return;
              const exTopic = findExerciseTopic(
                selectedLecture,
                link.exerciseTopicId,
                link.exerciseId || ''
              );
              if (!exTopic) return;
              if (materialMode === 'lecture' && selectedTopic?.id) {
                setReturnLectureTopicId(selectedTopic.id);
              }
              setMaterialMode('exercise');
              setSelectedExerciseId(link.exerciseId || selectedExerciseId || '');
              setSelectedTopic(exTopic);
              setPendingExerciseNav({
                subtopicId: link.exerciseSubtopicId || null
              });
              setView('topic');
            }}
            onBack={() => {
              if (returnLectureTopicId && materialMode === 'exercise' && selectedLecture) {
                const lecTopic = selectedLecture.topics?.find((t) => t.id === returnLectureTopicId);
                if (lecTopic) {
                  setSelectedTopic(lecTopic);
                  setMaterialMode('lecture');
                  setReturnLectureTopicId(null);
                  setView('topic');
                  return;
                }
              }
              setReturnLectureTopicId(null);
              setView('lecture');
            }}
            initialOpenSubtopicId={
              pendingFocusSubtopicId ||
              (materialMode === 'exercise' ? pendingExerciseNav?.subtopicId : null) ||
              null
            }
            onInitialSubtopicConsumed={() => {
              setPendingFocusSubtopicId(null);
              setPendingExerciseNav(null);
            }}
            onTopicStudied={(updated) => {
              setSelectedLecture(updated);
              if (selectedTopic?.id) {
                const topics = getMaterialTopics(updated, materialMode, selectedExerciseId);
                const fresh = topics?.find((t) => t.id === selectedTopic.id);
                if (fresh) setSelectedTopic(fresh);
              }
              setLectureContentKey((k) => k + 1);
              bumpDashboard();
            }}
            onTopicUpdated={(updatedTopic) => {
              setSelectedTopic(updatedTopic);
              setLectureContentKey((k) => k + 1);
            }}
            onPromoteTopic={handlePromoteTopic}
            onOpenPromotedUnit={openCourseItemById}
            onNotify={showToast}
            sidebarHidden={sidebarHidden}
            onToggleSidebar={toggleSidebar}
          />
        )}
        {view === 'settings' && (
          <SettingsPanel state={state} update={update} onClose={() => setView('home')} />
        )}
      </main>

      {showImport && (
        <ImportModal
          courses={state.courses}
          onConfirm={runProcess}
          onCreateCourse={async ({ name }) => {
            const c = await window.api.createCourse({ name });
            await syncCourses();
            return c;
          }}
          onCancel={() => {
            setShowImport(false);
            setPendingPdf(null);
          }}
        />
      )}

      {processing && <ProcessingOverlay status={processing} />}
      <Toast message={toast} />

      {courseToDelete && (
        <DeleteCourseModal
          course={courseToDelete}
          folderPath={deleteFolderPath}
          onCancel={() => {
            setCourseToDelete(null);
            setDeleteFolderPath('');
          }}
          onRemoveAppOnly={() => handleDeleteCourse(false)}
          onDeleteDisk={() => handleDeleteCourse(true)}
        />
      )}

      {lectureToDelete && (
        <DeleteLectureModal
          lecture={lectureToDelete}
          folderPath={deleteLectureFolderPath}
          onCancel={() => {
            setLectureToDelete(null);
            setDeleteLectureFolderPath('');
          }}
          onRemoveAppOnly={() => handleDeleteLecture(false)}
          onDeleteDisk={() => handleDeleteLecture(true)}
        />
      )}

      <StudyPinOverlay />
    </div>
    </StudyPinsProvider>
  );
}

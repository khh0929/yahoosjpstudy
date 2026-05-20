import { useEffect, useState } from 'react';
import { storageGet, storageSet } from './lib/storage.js';
import { LoadingScreen, ErrorScreen } from './screens/LoadingScreen.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { LearnScreen } from './screens/LearnScreen.jsx';
import { QuizScreen } from './screens/QuizScreen.jsx';
import { ResultScreen } from './screens/ResultScreen.jsx';
import { SettingsScreen } from './screens/SettingsScreen.jsx';
import { InstallBanner } from './components/InstallBanner.jsx';

export default function App() {
  return (
    <>
      <AppContent />
      <InstallBanner />
    </>
  );
}

function AppContent() {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState(null);
  const [stats, setStats] = useState({});
  const [screen, setScreen] = useState('home');
  const [currentLesson, setCurrentLesson] = useState(null);
  const [quizMode, setQuizMode] = useState('typing');
  const [sessionResult, setSessionResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/data.json?v=' + Date.now());
        const json = await res.json();
        setData(json);
        const p = (await storageGet('jp-progress2')) || { unlockedLesson: 0, completedLessons: [], streak: 0, lastStudied: null };
        const s = (await storageGet('jp-stats')) || {};
        setProgress(p);
        setStats(s);
      } catch (e) {
        setError('데이터 로딩 실패: ' + e.message);
      }
      setLoading(false);
    })();
  }, []);

  async function saveProgress(p) {
    setProgress(p);
    await storageSet('jp-progress2', p);
  }
  async function saveStats(s) {
    setStats(s);
    await storageSet('jp-stats', s);
  }

  function updateStats(results) {
    const newStats = { ...stats };
    results.forEach(({ id, correct }) => {
      if (!newStats[id]) newStats[id] = { correct: 0, wrong: 0 };
      if (correct) newStats[id].correct++;
      else newStats[id].wrong++;
    });
    saveStats(newStats);
    return newStats;
  }

  function startLesson(lessonIdx) {
    setCurrentLesson({ type: 'lesson', lessonIdx });
    setScreen('learn');
  }

  function startReview(type) {
    if (!data) return;
    const completed = progress.completedLessons;
    const pool = [];
    data.curriculum.forEach((lesson, idx) => {
      if (completed.includes(idx)) {
        lesson.items.forEach((item) => pool.push({ ...item, lessonId: lesson.id }));
      }
    });
    if (pool.length === 0) return;
    let items;
    if (type === 'weak') {
      items = pool
        .filter((item) => stats[item.char] && stats[item.char].wrong > 0)
        .sort((a, b) => (stats[b.char]?.wrong || 0) - (stats[a.char]?.wrong || 0))
        .slice(0, 20);
      if (items.length === 0) items = pool.sort(() => Math.random() - 0.5).slice(0, 15);
    } else {
      items = pool.sort(() => Math.random() - 0.5).slice(0, 15);
    }
    setCurrentLesson({ type: 'review', items, reviewType: type });
    setScreen('quiz');
  }

  function onLessonComplete(lessonIdx, results) {
    const today = new Date().toDateString();
    const newProgress = {
      ...progress,
      unlockedLesson: Math.max(progress.unlockedLesson, lessonIdx + 1),
      completedLessons: [...new Set([...progress.completedLessons, lessonIdx])],
      lastStudied: today,
      streak: progress.lastStudied === new Date(Date.now() - 86400000).toDateString() ? progress.streak + 1 : 1,
    };
    saveProgress(newProgress);
    updateStats(results);
    const correct = results.filter((r) => r.correct).length;
    setSessionResult({ correct, total: results.length, lessonIdx });
    setScreen('result');
  }

  function onReviewComplete(results) {
    updateStats(results);
    const correct = results.filter((r) => r.correct).length;
    setSessionResult({ correct, total: results.length, lessonIdx: null });
    setScreen('result');
  }

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen msg={error} />;
  if (!data || !progress) return <LoadingScreen />;

  if (screen === 'settings') return <SettingsScreen onBack={() => setScreen('home')} />;
  if (screen === 'result')
    return (
      <ResultScreen
        result={sessionResult}
        onHome={() => setScreen('home')}
        onNext={
          sessionResult?.lessonIdx != null && sessionResult.lessonIdx + 1 < data.curriculum.length
            ? () => startLesson(sessionResult.lessonIdx + 1)
            : null
        }
      />
    );
  if (screen === 'learn')
    return (
      <LearnScreen
        lesson={data.curriculum[currentLesson.lessonIdx]}
        onComplete={() => setScreen('quiz')}
        onBack={() => setScreen('home')}
      />
    );
  if (screen === 'quiz')
    return (
      <QuizScreen
        items={currentLesson.type === 'review' ? currentLesson.items : data.curriculum[currentLesson.lessonIdx].items}
        allItems={data.curriculum.flatMap((l) => l.items)}
        quizMode={quizMode}
        onModeChange={setQuizMode}
        onComplete={
          currentLesson.type === 'review'
            ? onReviewComplete
            : (results) => onLessonComplete(currentLesson.lessonIdx, results)
        }
        onBack={() => setScreen(currentLesson.type === 'review' ? 'home' : 'learn')}
      />
    );

  return (
    <HomeScreen
      data={data}
      progress={progress}
      stats={stats}
      onStart={startLesson}
      onReview={startReview}
      onSettings={() => setScreen('settings')}
    />
  );
}

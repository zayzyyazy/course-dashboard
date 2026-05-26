import { useState, useEffect, useCallback } from 'react';

export function useStore() {
  const [state, setState] = useState({
    apiKey: '',
    generationModel: 'gpt-4o',
    vaultPath: '',
    courses: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([window.api.storeGetAll(), window.api.getCourses()]).then(([data, courses]) => {
      setState({ ...data, courses: courses || data.courses || [] });
      setLoading(false);
    });
  }, []);

  const update = useCallback(async (key, value) => {
    await window.api.storeSet(key, value);
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { state, loading, update };
}

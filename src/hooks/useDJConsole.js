import { useCallback, useReducer } from 'react';
import { axesFromMbti } from '../lib/mbti';

const initialState = {
  axes: axesFromMbti('INTJ'),
  style: { energy: 50, texture: 35, brightness: 40 },
  mode: 'focus',
  vocalMode: 'instrumental',
  genre: '',
  projectName: '',
  projectDesc: '',
  projectAnalysis: null,
  analysisSource: '',
  promptData: null,
  promptLoading: true,
  generating: false,
  fallback: false,
  schedule: null,
  currentPhase: null,
  mixerImport: null,
};

function valueFromAction(current, value) {
  return typeof value === 'function' ? value(current) : value;
}

function djConsoleReducer(state, action) {
  switch (action.type) {
    case 'set': {
      return {
        ...state,
        [action.field]: valueFromAction(state[action.field], action.value),
      };
    }
    default:
      return state;
  }
}

function useFieldSetter(dispatch, field) {
  return useCallback((value) => {
    dispatch({ type: 'set', field, value });
  }, [dispatch, field]);
}

export function useDJConsole() {
  const [state, dispatch] = useReducer(djConsoleReducer, initialState);

  return {
    ...state,
    setAxes: useFieldSetter(dispatch, 'axes'),
    setStyle: useFieldSetter(dispatch, 'style'),
    setMode: useFieldSetter(dispatch, 'mode'),
    setVocalMode: useFieldSetter(dispatch, 'vocalMode'),
    setGenre: useFieldSetter(dispatch, 'genre'),
    setProjectName: useFieldSetter(dispatch, 'projectName'),
    setProjectDesc: useFieldSetter(dispatch, 'projectDesc'),
    setProjectAnalysis: useFieldSetter(dispatch, 'projectAnalysis'),
    setAnalysisSource: useFieldSetter(dispatch, 'analysisSource'),
    setPromptData: useFieldSetter(dispatch, 'promptData'),
    setPromptLoading: useFieldSetter(dispatch, 'promptLoading'),
    setGenerating: useFieldSetter(dispatch, 'generating'),
    setFallback: useFieldSetter(dispatch, 'fallback'),
    setSchedule: useFieldSetter(dispatch, 'schedule'),
    setCurrentPhase: useFieldSetter(dispatch, 'currentPhase'),
    setMixerImport: useFieldSetter(dispatch, 'mixerImport'),
  };
}

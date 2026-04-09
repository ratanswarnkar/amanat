import { api } from './client';

export const saveSecurityQuestions = async (questions) => {
  const { data } = await api.post('/security-questions/save', {
    questions,
  });
  return data;
};

export const getSecurityQuestionChallenge = async (nomineeId) => {
  const { data } = await api.get(`/security-questions/challenge/${nomineeId}`);
  return data;
};

export const verifySecurityQuestions = async ({ nominee_id, answers }) => {
  const { data } = await api.post('/security-questions/verify', {
    nominee_id,
    answers,
  });
  return data;
};

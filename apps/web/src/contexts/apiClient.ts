import axios from 'axios';
import { API_BASE_URL } from '../api/client';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for session cookies
});

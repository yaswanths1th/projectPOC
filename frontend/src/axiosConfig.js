import axios from "axios";
import { API_URL } from "./config/api";

axios.defaults.baseURL = API_URL;

// Set token if exists
const token = localStorage.getItem("access");
if (token) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

export default axios;

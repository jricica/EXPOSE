import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Profile from "./modules/profile/Profile";
import NotFound from "./NotFound"; 

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default App;
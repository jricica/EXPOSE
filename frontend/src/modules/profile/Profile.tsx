import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../auth/AuthContext";
import { profileService } from "./profile.service";
import "./Profile.css";
import LoadingState from "../../components/UI./LoadingState";
import EmptyState from "../../components/UI./EmptyState";
import ErrorState from "../../components/UI./ErrorState";

const Profile = () => {
  const { user, login } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || "",
    bio: user?.bio || "",
    avatar_url: user?.avatar_url || "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || "",
        bio: user.bio || "",
        avatar_url: user.avatar_url || "",
      });
    }
  }, [user]);

  const handleEditToggle = () => setIsEditing(!isEditing);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatedUser = await profileService.updateProfile(formData);
      // Actualizar el contexto de auth con los nuevos datos
      // Necesitamos el token actual para llamar a login
      const token = localStorage.getItem('auth_token');
      if (token) {
        login(token, updatedUser);
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("No se pudo actualizar el perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="profile-container">
        <section className="profile-info">
          <div className="profile-header">
            <div className="profile-avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.display_name || user.username} />
              ) : (
                user?.username?.charAt(0).toUpperCase() || "?"
              )}
            </div>

            <div>
              <h2>{user?.display_name || user?.username || "Usuario"}</h2>
              <p className="profile-alias">@{user?.username}</p>
              {user?.bio && <p className="profile-bio">{user.bio}</p>}
              {!isEditing && (
                <button className="edit-profile-btn" onClick={handleEditToggle}>
                  Editar Perfil
                </button>
              )}
            </div>
          </div>
        </section>

        {isEditing && (
          <section className="profile-edit">
            <form className="edit-profile-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre a mostrar</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="form-group">
                <label>Biografía</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Cuéntanos sobre ti..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>URL del Avatar</label>
                <input
                  type="text"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  placeholder="https://ejemplo.com/foto.jpg"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar cambios"}
                </button>
                <button type="button" className="cancel-btn" onClick={handleEditToggle}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Mantenemos la sección de publicaciones aunque sean mock por ahora */}
        <section className="profile-posts">
          <h3>Publicaciones recientes</h3>
          <div className="profile-post">
            <p>Tus momentos efímeros aparecerán aquí.</p>
            <span>Ejemplo de publicación</span>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Profile;

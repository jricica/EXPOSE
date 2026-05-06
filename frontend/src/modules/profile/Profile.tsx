import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../auth/AuthContext";
import "./Profile.css";
import { profileService } from "./profile.service";

const Profile = () => {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(null);

    try {
      const updatedUser = await profileService.updateProfile(formData);

      setUser(updatedUser);
      setIsEditing(false);
      setMessage("Perfil actualizado correctamente");
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("No se pudo actualizar el perfil");
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
              <p className="profile-status">Rol: {user?.role === 0 || user?.role === "admin" ? "Admin" : "Usuario"}</p>
              {!isEditing && (
                <button className="edit-profile-btn" onClick={handleEditToggle}>
                  Editar Perfil
                </button>
              )}
            </div>
          </div>
          {message ? <p className="profile-message">{message}</p> : null}
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

        <section className="profile-posts">
          <h3>Estado de la cuenta</h3>
          <div className="profile-post">
            <p>Tu perfil esta listo para interactuar con feed, likes y comentarios.</p>
            <span>Actualiza tus datos para mejorar tu presencia en la plataforma.</span>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Profile;

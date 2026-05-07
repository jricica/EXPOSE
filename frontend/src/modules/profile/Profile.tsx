import { useEffect, useRef, useState } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../auth/AuthContext";
import "./Profile.css";
import { profileService } from "./profile.service";

type Tab = "overview" | "edit" | "security";

const Profile = () => {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [formData, setFormData] = useState({
    display_name: user?.display_name || "",
    bio: user?.bio || "",
    avatar_url: user?.avatar_url || "",
  });
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Identidad", icon: "∅" },
    { id: "edit", label: "Modificar", icon: "⌁" },
    { id: "security", label: "Rastros", icon: "⌧" },
  ];

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || "",
        bio: user.bio || "",
        avatar_url: user.avatar_url || "",
      });
      setAvatarPreview(user.avatar_url || "");
    }
  }, [user]);

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    const el = tabRefs.current[idx];
    if (el) {
      setTabIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab]);

  const handleAvatarUrlChange = (val: string) => {
    setFormData((f) => ({ ...f, avatar_url: val }));
    setAvatarPreview(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveStatus("idle");

    try {
      const updatedUser = await profileService.updateProfile(formData);
      setUser(updatedUser);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    setUploading(true);
    try {
      const { url } = await profileService.uploadAvatar(file);
      handleAvatarUrlChange(url);

      // Auto-save so the avatar persists immediately without clicking "Guardar"
      const updatedUser = await profileService.updateProfile({ avatar_url: url });
      setUser(updatedUser);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const updatedUser = await profileService.updateProfile({ avatar_url: null });
      setUser(updatedUser);
      setAvatarPreview("");
      setFormData((f) => ({ ...f, avatar_url: "" }));
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
  };

  const isAdmin = user?.role === 0 || user?.role === "admin";
  const initials = (user?.display_name || user?.username || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Layout>
      <div className="profile-page">
        <div className="profile-banner">
          <div className="profile-banner-gradient" />
          <div className="profile-banner-code">NO PROFILE / NO TRACE / 24H</div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-ring">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={user?.display_name || user?.username}
                  className="profile-avatar-img"
                  onError={() => setAvatarPreview("")}
                />
              ) : (
                <span className="profile-avatar-initials">{initials}</span>
              )}
            </div>
            {isAdmin && <span className="profile-badge-admin">Admin</span>}
          </div>

          <div className="profile-meta">
            <h1 className="profile-name">{user?.display_name || user?.username || "Anónimo"}</h1>
            <span className="profile-username">@{user?.username || "origen_desconocido"}</span>
            <p className="profile-bio-text">
              {user?.bio || "Esta identidad existe solo dentro del canal. Nada aquí está hecho para quedarse."}
            </p>
          </div>

          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-value">24H</span>
              <span className="profile-stat-label">Duración</span>
            </div>
            <div className="profile-stat-divider" />
            <div className="profile-stat">
              <span className="profile-stat-value">0</span>
              <span className="profile-stat-label">Seguidores</span>
            </div>
            <div className="profile-stat-divider" />
            <div className="profile-stat">
              <span className="profile-stat-value">∅</span>
              <span className="profile-stat-label">Huella</span>
            </div>
          </div>

          <div className="profile-tabs">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                className={`profile-tab-btn${activeTab === tab.id ? " active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
            <span
              className="profile-tab-indicator"
              style={{ left: tabIndicatorStyle.left, width: tabIndicatorStyle.width }}
            />
          </div>
        </div>

        <div className="profile-panels">
          {activeTab === "overview" && (
            <div className="profile-panel fade-in">
              <div className="info-grid">
                <div className="info-card">
                  <div className="info-card-icon">✉</div>
                  <div>
                    <p className="info-card-label">Acceso</p>
                    <p className="info-card-value">{user?.email || "—"}</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card-icon">∅</div>
                  <div>
                    <p className="info-card-label">Alias interno</p>
                    <p className="info-card-value">@{user?.username || "—"}</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card-icon">⌧</div>
                  <div>
                    <p className="info-card-label">Estado</p>
                    <p className="info-card-value">{isAdmin ? "Acceso administrativo" : "Identidad temporal"}</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card-icon">⌁</div>
                  <div>
                    <p className="info-card-label">Nota</p>
                    <p className="info-card-value">{user?.bio || "Sin nota visible."}</p>
                  </div>
                </div>
              </div>

              <div className="profile-cta-row">
                <button className="cta-btn primary" onClick={() => setActiveTab("edit")}>
                  Modificar identidad
                </button>
              </div>
            </div>
          )}

          {activeTab === "edit" && (
            <div className="profile-panel fade-in">
              <form className="edit-form" onSubmit={handleSubmit}>
                <div className="avatar-editor">
                  <div className="avatar-editor-preview">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="preview" onError={() => setAvatarPreview("")} />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <div className="avatar-editor-input">
                    <label>Imagen temporal</label>
                    <div className="avatar-upload-row">
                      <input
                        type="url"
                        value={formData.avatar_url}
                        onChange={(e) => handleAvatarUrlChange(e.target.value)}
                        placeholder="https://..."
                      />
                      <button 
                        type="button" 
                        className="upload-btn" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? "..." : "Subir"}
                      </button>
                      {avatarPreview && (
                        <button
                          type="button"
                          className="upload-btn remove-btn"
                          onClick={handleRemoveAvatar}
                          disabled={uploading}
                          title="Eliminar imagen"
                        >
                          ✕
                        </button>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        accept="image/*" 
                        onChange={handleFileChange}
                      />
                    </div>
                    <p className="field-hint">Usa una imagen que no te identifique directamente o súbela desde tu equipo.</p>
                  </div>
                </div>

                <div className="field-group">
                  <label>Nombre visible</label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Alias temporal"
                    maxLength={50}
                  />
                  <span className="char-count">{formData.display_name.length}/50</span>
                </div>

                <div className="field-group">
                  <label>Nota breve</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Algo mínimo. Nada permanente."
                    rows={4}
                    maxLength={200}
                  />
                  <span className="char-count">{formData.bio.length}/200</span>
                </div>

                <div className="edit-form-footer">
                  {saveStatus === "success" && <span className="save-feedback success">Cambios guardados</span>}
                  {saveStatus === "error" && <span className="save-feedback error">Error al guardar</span>}
                  <button type="submit" className="cta-btn primary" disabled={loading}>
                    {loading ? <span className="spinner" /> : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "security" && (
            <div className="profile-panel fade-in">
              <div className="security-grid">
                <div className="security-item">
                  <div className="security-item-icon ok">✓</div>
                  <div>
                    <p className="security-item-title">Sesión activa</p>
                    <p className="security-item-desc">Tu acceso está activo en este dispositivo.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">⌧</div>
                  <div>
                    <p className="security-item-title">Capturas</p>
                    <p className="security-item-desc">La experiencia está diseñada para evitar guardar rastros.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">24</div>
                  <div>
                    <p className="security-item-title">Caducidad</p>
                    <p className="security-item-desc">Las publicaciones están pensadas para desaparecer en 24 horas.</p>
                  </div>
                </div>

                <div className="security-item">
                  <div className="security-item-icon">∅</div>
                  <div>
                    <p className="security-item-title">Sin perfil público</p>
                    <p className="security-item-desc">EXPOSE no está hecho para acumular seguidores ni construir una marca personal.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
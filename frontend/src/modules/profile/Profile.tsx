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
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Perfil", icon: "👤" },
    { id: "edit", label: "Editar", icon: "✏️" },
    { id: "security", label: "Seguridad", icon: "🔒" },
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
        {/* ── Banner ── */}
        <div className="profile-banner">
          <div className="profile-banner-gradient" />
          <div className="profile-banner-shapes">
            <span /><span /><span />
          </div>
        </div>

        {/* ── Card ── */}
        <div className="profile-card">
          {/* Avatar */}
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-ring">
              {(avatarPreview || user?.avatar_url) ? (
                <img
                  src={avatarPreview || user?.avatar_url}
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

          {/* Name + meta */}
          <div className="profile-meta">
            <h1 className="profile-name">{user?.display_name || user?.username || "Usuario"}</h1>
            <span className="profile-username">@{user?.username}</span>
            {user?.bio && <p className="profile-bio-text">{user.bio}</p>}
          </div>

          {/* Stats */}
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-value">—</span>
              <span className="profile-stat-label">Posts</span>
            </div>
            <div className="profile-stat-divider" />
            <div className="profile-stat">
              <span className="profile-stat-value">—</span>
              <span className="profile-stat-label">Seguidores</span>
            </div>
            <div className="profile-stat-divider" />
            <div className="profile-stat">
              <span className="profile-stat-value">—</span>
              <span className="profile-stat-label">Siguiendo</span>
            </div>
          </div>

          {/* Tabs */}
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

        {/* ── Tab Panels ── */}
        <div className="profile-panels">

          {/* Overview */}
          {activeTab === "overview" && (
            <div className="profile-panel fade-in">
              <div className="info-grid">
                <div className="info-card">
                  <div className="info-card-icon">📧</div>
                  <div>
                    <p className="info-card-label">Email</p>
                    <p className="info-card-value">{user?.email || "—"}</p>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-icon">🪪</div>
                  <div>
                    <p className="info-card-label">Nombre de usuario</p>
                    <p className="info-card-value">@{user?.username || "—"}</p>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-icon">🛡️</div>
                  <div>
                    <p className="info-card-label">Rol</p>
                    <p className="info-card-value">{isAdmin ? "Administrador" : "Usuario"}</p>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-icon">💬</div>
                  <div>
                    <p className="info-card-label">Bio</p>
                    <p className="info-card-value">{user?.bio || "Sin bio todavía"}</p>
                  </div>
                </div>
              </div>

              <div className="profile-cta-row">
                <button className="cta-btn primary" onClick={() => setActiveTab("edit")}>
                  ✏️ Editar perfil
                </button>
              </div>
            </div>
          )}

          {/* Edit */}
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
                    <label>URL de avatar</label>
                    <input
                      type="url"
                      value={formData.avatar_url}
                      onChange={(e) => handleAvatarUrlChange(e.target.value)}
                      placeholder="https://ejemplo.com/foto.jpg"
                    />
                    <p className="field-hint">Pega el enlace de tu imagen — verás una vista previa en tiempo real.</p>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Nombre a mostrar</label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="Tu nombre"
                      maxLength={50}
                    />
                    <span className="char-count">{formData.display_name.length}/50</span>
                  </div>
                </div>

                <div className="field-group">
                  <label>Biografía</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Cuéntanos sobre ti..."
                    rows={4}
                    maxLength={200}
                  />
                  <span className="char-count">{formData.bio.length}/200</span>
                </div>

                <div className="edit-form-footer">
                  {saveStatus === "success" && (
                    <span className="save-feedback success">✓ Cambios guardados</span>
                  )}
                  {saveStatus === "error" && (
                    <span className="save-feedback error">✗ Error al guardar</span>
                  )}
                  <button type="submit" className="cta-btn primary" disabled={loading}>
                    {loading ? <span className="spinner" /> : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Security */}
          {activeTab === "security" && (
            <div className="profile-panel fade-in">
              <div className="security-grid">
                <div className="security-item">
                  <div className="security-item-icon ok">✓</div>
                  <div>
                    <p className="security-item-title">Cuenta activa</p>
                    <p className="security-item-desc">Tu cuenta está verificada y activa en la plataforma.</p>
                  </div>
                </div>
                <div className="security-item">
                  <div className="security-item-icon">🔑</div>
                  <div>
                    <p className="security-item-title">Contraseña</p>
                    <p className="security-item-desc">Última actualización desconocida.</p>
                  </div>
                  <button className="cta-btn ghost small">Cambiar</button>
                </div>
                <div className="security-item">
                  <div className="security-item-icon">📱</div>
                  <div>
                    <p className="security-item-title">Autenticación en dos pasos</p>
                    <p className="security-item-desc">Añade una capa extra de seguridad a tu cuenta.</p>
                  </div>
                  <button className="cta-btn ghost small">Activar</button>
                </div>
                <div className="security-item">
                  <div className="security-item-icon">🌐</div>
                  <div>
                    <p className="security-item-title">Sesiones activas</p>
                    <p className="security-item-desc">Solo esta sesión está activa actualmente.</p>
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

import Layout from "../../components/Layout";
import "./Profile.css";

const mockPosts = [
  {
    id: 1,
    content: "Primer momento expuesto.",
    timeLeft: "45 min",
  },
  {
    id: 2,
    content: "Pensamientos nocturnos.",
    timeLeft: "23 min",
  },
  {
    id: 3,
    content: "Esto desaparecerá pronto.",
    timeLeft: "5 min",
  },
];

const Profile = () => {
  return (
    <Layout>
      <div className="profile-container">
      <section className="profile-info">
  <div className="profile-header">
    <div className="profile-avatar">?</div>

    <div>
      <h2>Perfil anónimo</h2>
      <p className="profile-alias">Alias: usuario_efimero</p>
      <p className="profile-status">Estado: activo ahora</p>
      <p className="profile-time">Sesión válida por 1 hora</p>
    </div>
  </div>
</section>

        <section className="profile-posts">
          <h3>Publicaciones recientes</h3>

          {mockPosts.map((post) => (
            <div key={post.id} className="profile-post">
              <p>{post.content}</p>
              <span>{post.timeLeft} restantes</span>
            </div>
          ))}
        </section>
      </div>
    </Layout>
  );
};

export default Profile;
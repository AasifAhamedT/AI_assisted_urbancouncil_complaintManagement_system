import { useAuth } from "../auth/AuthContext";
import { Icon, type IconName } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";

const allFeatures: Array<{ title: string; description: string; phase: string; icon: IconName; roles: string[] }> = [
  { title: "Reassignment workflow", description: "Request and approve department reassignment without changing complaint status.", phase: "Phase 14", icon: "complaints", roles: ["DEPARTMENT", "ADMINISTRATOR"] },
  { title: "Notifications", description: "Receive durable in-app updates for relevant complaint events.", phase: "Phase 15", icon: "alert", roles: ["CITIZEN", "DEPARTMENT", "ADMINISTRATOR"] },
  { title: "Council knowledge chatbot", description: "Ask grounded public-information questions with source references.", phase: "Phase 16", icon: "future", roles: ["CITIZEN"] },
  { title: "Reports and analytics", description: "View authorized workload, duration, and outcome statistics.", phase: "Phase 17", icon: "dashboard", roles: ["DEPARTMENT", "ADMINISTRATOR"] },
  { title: "Knowledge documents", description: "Manage approved source documents used by the RAG service.", phase: "Phase 16", icon: "settings", roles: ["ADMINISTRATOR"] }
];

export const FutureFeaturesPage = () => {
  const { session } = useAuth();
  const features = allFeatures.filter((item) => session && item.roles.includes(session.user.role));
  return <div className="page-wrap"><PageHeader eyebrow="Approved roadmap" title="Upcoming tools" description="These interfaces are intentionally disabled until their backend security and data contracts are implemented and verified." /><section className="future-grid">{features.map((feature) => <article className="panel future-card" key={feature.title}><span><Icon name={feature.icon} /></span><div><small>{feature.phase}</small><h2>{feature.title}</h2><p>{feature.description}</p><strong>Coming later</strong></div></article>)}</section><div className="roadmap-note"><Icon name="shield" /><div><strong>No simulated or insecure actions</strong><p>Future controls will appear only after their backend authorization and storage rules are complete.</p></div></div></div>;
};

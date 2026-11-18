import { useAuth } from "../auth/AuthContext";
import { EmptyState } from "../components/Feedback";
import { Icon, type IconName } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";

const allFeatures: Array<{ title: string; description: string; phase: string; icon: IconName; roles: string[] }> = [
];

export const FutureFeaturesPage = () => {
  const { session } = useAuth();
  const features = allFeatures.filter((item) => session && item.roles.includes(session.user.role));
  return <div className="page-wrap"><PageHeader eyebrow="Approved roadmap" title="Upcoming tools" description="Interfaces appear here only after their requirements and security boundaries are approved." />{features.length > 0 ? <section className="future-grid">{features.map((feature) => <article className="panel future-card" key={feature.title}><span><Icon name={feature.icon} /></span><div><small>{feature.phase}</small><h2>{feature.title}</h2><p>{feature.description}</p><strong>Coming later</strong></div></article>)}</section> : <section className="panel"><EmptyState title="No additional interface is approved yet" description="Phase 17 reporting is now available from the Reports navigation item for authorized accounts." /></section>}<div className="roadmap-note"><Icon name="shield" /><div><strong>No simulated or insecure actions</strong><p>Future controls will appear only after their backend authorization and storage rules are complete.</p></div></div></div>;
};

import {
  AlertCircle,
  CircleHelp,
  FileSearch,
  LoaderCircle,
  WifiOff,
} from "lucide-react";

const states = {
  loading: {
    icon: LoaderCircle,
    title: "Loading...",
    description: "Please wait while this information is prepared.",
    iconClass: "feedback-icon-blue is-spinning",
  },
  empty: {
    icon: FileSearch,
    title: "No records found.",
    description: "There is no information to display here yet.",
    iconClass: "feedback-icon-muted",
  },
  error: {
    icon: AlertCircle,
    title: "Unable to load this information.",
    description: "Please try again. If the problem continues, contact your administrator.",
    iconClass: "feedback-icon-red",
  },
  unauthorized: {
    icon: CircleHelp,
    title: "Access unavailable.",
    description: "Your account may not have access to this information.",
    iconClass: "feedback-icon-amber",
  },
  network: {
    icon: WifiOff,
    title: "Connection unavailable.",
    description: "Check your network connection and try again.",
    iconClass: "feedback-icon-amber",
  },
};

export default function FeedbackState({
  type = "empty",
  title,
  description,
  compact = false,
}) {
  const state = states[type] ?? states.empty;
  const Icon = state.icon;

  return (
    <div
      className={`feedback-state${compact ? " is-compact" : ""}`}
      role={type === "error" || type === "network" ? "alert" : "status"}
    >
      <span className={`feedback-icon ${state.iconClass}`}>
        <Icon size={compact ? 18 : 22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div>
        <h3>{title ?? state.title}</h3>
        {description ?? state.description ? (
          <p>{description ?? state.description}</p>
        ) : null}
      </div>
    </div>
  );
}

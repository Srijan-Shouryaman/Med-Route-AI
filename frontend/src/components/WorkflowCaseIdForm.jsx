export default function WorkflowCaseIdForm({ value, onChange, onSubmit, busy = false, submitLabel = "Load case" }) {
  return (
    <form className="workflow-case-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label className="patient-field">
        <span>Case ID <b>*</b></span>
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Enter a case ID, such as C0102" required autoComplete="off" />
      </label>
      <button className="patient-primary-button" type="submit" disabled={busy || !value.trim()}>{busy ? "Loading..." : submitLabel}</button>
    </form>
  );
}

import { useState, useEffect, useRef, useCallback, memo } from "react";
import emailjs from "@emailjs/browser";

const countries = [
  { name: "United States", code: "+1", flag: "🇺🇸" },
  { name: "Pakistan", code: "+92", flag: "🇵🇰" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "India", code: "+91", flag: "🇮🇳" },
  { name: "Australia", code: "+61", flag: "🇦🇺" },
  { name: "Germany", code: "+49", flag: "🇩🇪" },
  { name: "France", code: "+33", flag: "🇫🇷" },
  { name: "Japan", code: "+81", flag: "🇯🇵" },
  { name: "China", code: "+86", flag: "🇨🇳" },
];

const COUNTRY_MAP = Object.fromEntries(countries.map(c => [c.name, c]));
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i);

const CARD_PATTERNS = [
  { type: "amex",       re: /^3[47]/ },
  { type: "discover",   re: /^6(?:011|5)/ },
  { type: "mastercard", re: /^5[1-5]|^2[2-7]/ },
  { type: "visa",       re: /^4/ },
];

function detectCardType(number) {
  const n = number.replace(/\s/g, "");
  return CARD_PATTERNS.find(p => p.re.test(n))?.type ?? null;
}

function formatCardNumber(value) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

const CardIcon = memo(function CardIcon({ type }) {
  const icons = {
    visa: (
      <svg viewBox="0 0 48 48" style={{ width: 32, height: 20 }}>
        <rect width="48" height="48" rx="4" fill="#1A1F71" />
        <text x="24" y="32" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial">VISA</text>
      </svg>
    ),
    mastercard: (
      <svg viewBox="0 0 48 48" style={{ width: 32, height: 20 }}>
        <circle cx="18" cy="24" r="14" fill="#EB001B" />
        <circle cx="30" cy="24" r="14" fill="#F79E1B" fillOpacity="0.85" />
      </svg>
    ),
    amex: (
      <svg viewBox="0 0 48 48" style={{ width: 32, height: 20 }}>
        <rect width="48" height="48" rx="4" fill="#2E77BC" />
        <text x="24" y="30" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">AMEX</text>
      </svg>
    ),
    discover: (
      <svg viewBox="0 0 48 48" style={{ width: 32, height: 20 }}>
        <rect width="48" height="48" rx="4" fill="#231F20" />
        <circle cx="30" cy="24" r="12" fill="#F76F20" />
        <text x="14" y="29" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">DISC</text>
      </svg>
    ),
  };
  return icons[type] || null;
});

function validate(step, values) {
  const errors = {};
  if (step === 1) {
    if (!values.name.trim()) errors.name = "Required";
    const raw = values.cardNumber.replace(/\s/g, "");
    if (!/^\d{16}$/.test(raw)) errors.cardNumber = "Must be 16 digits";
    if (!values.expiryMonth) errors.expiryMonth = "Required";
    if (!values.expiryYear) errors.expiryYear = "Required";
    const cvvLen = detectCardType(raw) === "amex" ? 4 : 3;
    if (!new RegExp(`^\\d{${cvvLen}}$`).test(values.cvv)) errors.cvv = `${cvvLen} digits required`;
    if (!values.amount || parseFloat(values.amount) <= 0) errors.amount = "Enter valid amount";
  }
  if (step === 2) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) errors.email = "Invalid email";
    if (!/^\d{7,15}$/.test(values.phone)) errors.phone = "Invalid phone";
    if (!values.address1.trim()) errors.address1 = "Required";
    if (!values.city.trim()) errors.city = "Required";
    if (!values.state.trim()) errors.state = "Required";
    if (!values.postal.trim()) errors.postal = "Required";
  }
  return errors;
}

const INIT = {
  name: "", cardNumber: "", expiryMonth: "", expiryYear: "",
  cvv: "", amount: "", email: "", country: countries[0].name,
  phone: "", address1: "", address2: "", city: "", state: "", postal: "",
};

function StepTransition({ children, direction }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = direction === "forward" ? 40 : -40;
    el.animate(
      [{ opacity: 0, transform: `translateX(${from}px)` }, { opacity: 1, transform: "translateX(0px)" }],
      { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
    );
  }, []);
  return <div ref={ref} style={{ willChange: "transform, opacity" }}>{children}</div>;
}

const Field = memo(function Field({ label, error, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ color: "#6b7280", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
      <div style={{
        overflow: "hidden",
        maxHeight: error || hint ? 20 : 0,
        opacity: error || hint ? 1 : 0,
        transition: "max-height 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease",
      }}>
        {error
          ? <span style={{ color: "#ef4444", fontSize: "11px" }}>{error}</span>
          : hint
          ? <span style={{ color: "#9ca3af", fontSize: "11px" }}>{hint}</span>
          : null}
      </div>
    </div>
  );
});

function Input({ style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width: "100%",
        background: focused ? "#ffffff" : "#f9fafb",
        border: `1px solid ${focused ? "#6366f1" : props["data-error"] ? "#ef4444" : "#e5e7eb"}`,
        borderRadius: "10px",
        color: "#111827",
        padding: "10px 14px",
        fontSize: "14px",
        outline: "none",
        transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.15)" : "0 0 0 0px rgba(99,102,241,0)",
        ...style,
      }}
    />
  );
}

function Select({ style, children, "data-error": dataError, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width: "100%",
        background: focused ? "#ffffff" : "#f9fafb",
        border: `1px solid ${focused ? "#6366f1" : dataError ? "#ef4444" : "#e5e7eb"}`,
        borderRadius: "10px",
        color: "#111827",
        padding: "10px 14px",
        fontSize: "14px",
        outline: "none",
        transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        cursor: "pointer",
        boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.15)" : "0 0 0 0px rgba(99,102,241,0)",
        ...style,
      }}
    >
      {children}
    </select>
  );
}

function Btn({ children, onClick, style, ghost, loading, disabled }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isDisabled = loading || disabled;
  const base = ghost ? ghostBtnStyle : btnStyle;
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => !isDisabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        ...base,
        transform: pressed ? "scale(0.975)" : hovered && !isDisabled ? "scale(1.015)" : "scale(1)",
        boxShadow: hovered && !ghost && !isDisabled
          ? "0 8px 24px rgba(99,102,241,0.25)"
          : "0 0px 0px rgba(99,102,241,0)",
        opacity: isDisabled ? 0.6 : ghost && hovered ? 1 : ghost ? 0.8 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
        transition: "transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease, opacity 0.2s ease, background 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...style,
      }}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{
        width: 14, height: 14,
        border: "2px solid rgba(255,255,255,0.4)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "_spin 0.7s linear infinite",
        flexShrink: 0,
      }} />
    </>
  );
}

export default function PaymentPage() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("forward");
  const [values, setValues] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const cardType = detectCardType(values.cardNumber);
  const countryObj = COUNTRY_MAP[values.country] ?? countries[0];

  const handleChange = useCallback(e => {
    let { name, value } = e.target;
    if (name === "cardNumber") value = formatCardNumber(value);
    setValues(v => ({ ...v, [name]: value }));
    setErrors(err => ({ ...err, [name]: undefined }));
  }, []);

  const goTo = useCallback((next, cur) => {
    setDirection(next > cur ? "forward" : "back");
    setStep(next);
  }, []);

  const nextStep = useCallback(() => {
    setStep(cur => {
      const errs = validate(cur, values);
      setErrors(errs);
      if (Object.keys(errs).length === 0) {
        setDirection("forward");
        return cur + 1;
      }
      return cur;
    });
  }, [values]);

  const handleSubmit = useCallback(async () => {
    const errs = validate(2, values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const cardT = detectCardType(values.cardNumber);
      await emailjs.send(
        "service_kegolbe",
        "template_vqxbj6t",
        {
          date:            new Date().toLocaleDateString("en-US", { dateStyle: "full" }),
          amount:          parseFloat(values.amount).toFixed(2),
          cardholder_name: values.name,
          card_last4:      values.cardNumber.replace(/\s/g, "").slice(-4),
          card_type:       cardT ? cardT.charAt(0).toUpperCase() + cardT.slice(1) : "Card",
          expiry_month:    values.expiryMonth,
          expiry_year:     values.expiryYear,
          email:           values.email,
          phone:           `${countryObj.code} ${values.phone}`,
          country_code:    countryObj.code,
          address1:        values.address1,
          address2:        values.address2 || "—",
          city:            values.city,
          state:           values.state,
          postal:          values.postal,
          country:         values.country,
        },
        "K5yEavHfdUBcdrA4u"
      );
      setDone(true);
    } catch (err) {
      console.error("Payment failed:", err);
    } finally {
      setLoading(false);
    }
  }, [values, countryObj]);

  const cardLast4 = values.cardNumber.replace(/\s/g, "").slice(-4);
  const stepLabels = ["Card Details", "Billing Info", "Review"];

  if (done) {
    return (
      <div style={cardStyle}>
        <SuccessView
          amount={values.amount}
          cardLast4={cardLast4}
          email={values.email}
          onReset={() => { setDone(false); setStep(1); setValues(INIT); setErrors({}); }}
        />
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: #c4c4cc; }
        select option { background: #ffffff; color: #111827; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      <div style={cardStyle}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h1 style={{ color: "#111827", fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                Secure Payment
              </h1>
              <p style={{ color: "#9ca3af", fontSize: 12, margin: "4px 0 0" }}>256-bit SSL encrypted</p>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {["visa", "mastercard", "amex", "discover"].map(t => (
                <div key={t} style={{
                  opacity: cardType === t ? 1 : cardType ? 0.2 : 0.5,
                  transform: cardType === t ? "scale(1.12)" : "scale(1)",
                  filter: cardType === t ? "drop-shadow(0 0 5px rgba(99,102,241,0.5))" : "none",
                  transition: "opacity 0.3s ease, transform 0.3s cubic-bezier(0.22,1,0.36,1), filter 0.3s ease",
                }}>
                  <CardIcon type={t} />
                </div>
              ))}
            </div>
          </div>

          {/* Step Indicator */}
          <div style={{ display: "flex", alignItems: "center" }}>
            {stepLabels.map((label, i) => {
              const sn = i + 1;
              const isActive = step === sn;
              const isDone = step > sn;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: isDone ? "#6366f1" : "transparent",
                      border: `2px solid ${isDone || isActive ? "#6366f1" : "#e5e7eb"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700,
                      color: isDone ? "#fff" : isActive ? "#6366f1" : "#9ca3af",
                      transition: "background 0.4s ease, border-color 0.4s ease, color 0.3s ease",
                    }}>
                      {isDone ? "✓" : sn}
                    </div>
                    <span style={{
                      fontSize: 10,
                      color: isActive ? "#6366f1" : isDone ? "#6366f1" : "#9ca3af",
                      fontWeight: isActive ? 600 : 400,
                      whiteSpace: "nowrap",
                      transition: "color 0.3s ease",
                    }}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div style={{
                      flex: 1, height: 2, margin: "0 8px", marginBottom: 16,
                      background: "#e5e7eb", borderRadius: 2, position: "relative", overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "#6366f1", borderRadius: 2,
                        transform: `scaleX(${step > sn ? 1 : 0})`,
                        transformOrigin: "left",
                        transition: "transform 0.5s cubic-bezier(0.22,1,0.36,1)",
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Steps */}
        <StepTransition key={step} direction={direction}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Amount (USD)" error={errors.amount}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 14, pointerEvents: "none" }}>$</span>
                  <Input name="amount" type="number" placeholder="0.00" value={values.amount}
                    onChange={handleChange} min="0.01" step="0.01"
                    data-error={errors.amount} style={{ paddingLeft: 26 }} />
                </div>
              </Field>

              <Field label="Name on Card" error={errors.name}>
                <Input name="name" type="text" placeholder="Full name as on card"
                  value={values.name} onChange={handleChange} data-error={errors.name} />
              </Field>

              <Field label="Card Number" error={errors.cardNumber}>
                <div style={{ position: "relative" }}>
                  <Input name="cardNumber" type="text" placeholder="0000 0000 0000 0000"
                    value={values.cardNumber} onChange={handleChange}
                    data-error={errors.cardNumber} maxLength={19}
                    style={{ paddingRight: 50, fontFamily: "monospace", letterSpacing: "0.1em" }} />
                  <div style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    opacity: cardType ? 1 : 0, transition: "opacity 0.25s ease",
                  }}>
                    {cardType && <CardIcon type={cardType} />}
                  </div>
                </div>
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Month" error={errors.expiryMonth}>
                  <Select name="expiryMonth" value={values.expiryMonth}
                    onChange={handleChange} data-error={errors.expiryMonth}>
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={String(i + 1).padStart(2, "0")}>{String(i + 1).padStart(2, "0")}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Year" error={errors.expiryYear}>
                  <Select name="expiryYear" value={values.expiryYear}
                    onChange={handleChange} data-error={errors.expiryYear}>
                    <option value="">YYYY</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </Select>
                </Field>
                <Field label="CVV" error={errors.cvv} hint={cardType === "amex" ? "4 digits" : "3 digits"}>
                  <Input name="cvv" type="password" placeholder="•••"
                    value={values.cvv} onChange={handleChange}
                    maxLength={cardType === "amex" ? 4 : 3}
                    data-error={errors.cvv}
                    style={{ fontFamily: "monospace", letterSpacing: "0.2em" }} />
                </Field>
              </div>

              <Btn onClick={nextStep} style={{ marginTop: 8 }}>Continue to Billing →</Btn>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Email" error={errors.email}>
                <Input name="email" type="email" placeholder="you@example.com"
                  value={values.email} onChange={handleChange} data-error={errors.email} />
              </Field>

              <Field label="Phone" error={errors.phone}>
                <div style={{ display: "flex", gap: 8 }}>
                  <Select name="country" value={values.country} onChange={handleChange}
                    style={{ width: "auto", minWidth: 110, flexShrink: 0 }}>
                    {countries.map(c => (
                      <option key={c.name} value={c.name}>{c.flag} {c.code}</option>
                    ))}
                  </Select>
                  <Input name="phone" type="tel" placeholder="Phone number"
                    value={values.phone} onChange={handleChange} data-error={errors.phone} />
                </div>
              </Field>

              <Field label="Address Line 1" error={errors.address1}>
                <Input name="address1" type="text" placeholder="Street address"
                  value={values.address1} onChange={handleChange} data-error={errors.address1} />
              </Field>

              <Field label="Address Line 2">
                <Input name="address2" type="text" placeholder="Apt, suite, floor (optional)"
                  value={values.address2} onChange={handleChange} />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="City" error={errors.city}>
                  <Input name="city" type="text" placeholder="City"
                    value={values.city} onChange={handleChange} data-error={errors.city} />
                </Field>
                <Field label="State / Region" error={errors.state}>
                  <Input name="state" type="text" placeholder="State"
                    value={values.state} onChange={handleChange} data-error={errors.state} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Postal Code" error={errors.postal}>
                  <Input name="postal" type="text" placeholder="00000"
                    value={values.postal} onChange={handleChange} data-error={errors.postal} />
                </Field>
                <Field label="Country">
                  <Select name="country" value={values.country} onChange={handleChange}>
                    {countries.map(c => (
                      <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <Btn ghost onClick={() => goTo(1, 2)}>← Back</Btn>
                <Btn onClick={nextStep} style={{ flex: 1 }}>Review Payment →</Btn>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Amount", value: `$${parseFloat(values.amount || 0).toFixed(2)}` },
                { label: "Cardholder", value: values.name || "—" },
                { label: "Email", value: values.email || "—" },
                { label: "Phone", value: `${countryObj.code} ${values.phone}` },
              ].map(({ label, value }, idx) => (
                <ReviewRow key={label} label={label} value={value} delay={idx * 55} />
              ))}

              <ReviewRow label="Card" delay={4 * 55}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {cardType && <CardIcon type={cardType} />}
                  <span style={{ color: "#111827", fontSize: 14, fontWeight: 500 }}>
                    •••• •••• •••• {cardLast4 || "????"}  {values.expiryMonth}/{String(values.expiryYear).slice(-2)}
                  </span>
                </div>
              </ReviewRow>

              <ReviewRow label="Billing Address" delay={5 * 55}>
                <p style={{ color: "#111827", fontSize: 13, fontWeight: 500, margin: 0, lineHeight: 1.7 }}>
                  {values.address1}{values.address2 ? `, ${values.address2}` : ""}<br />
                  {values.city}, {values.state} {values.postal}<br />
                  {values.country}
                </p>
              </ReviewRow>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <Btn ghost onClick={() => goTo(2, 3)} disabled={loading}>← Back</Btn>
                <Btn
                  onClick={handleSubmit}
                  loading={loading}
                  style={{ flex: 1, background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                >
                  {loading ? "Processing…" : `Confirm & Pay $${parseFloat(values.amount || 0).toFixed(2)}`}
                </Btn>
              </div>

              <p style={{ color: "#9ca3af", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                🔒 Your payment is protected by 256-bit SSL encryption
              </p>
            </div>
          )}
        </StepTransition>
      </div>
    </>
  );
}

function ReviewRow({ label, value, children, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate(
      [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 350, delay, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "forwards" }
    );
  }, []);
  return (
    <div ref={ref} style={{ ...reviewBox, opacity: 0 }}>
      <p style={reviewLabel}>{label}</p>
      {children || <p style={reviewValue}>{value}</p>}
    </div>
  );
}

function SuccessView({ amount, cardLast4, email, onReset }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate(
      [{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "scale(1)" }],
      { duration: 500, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "forwards" }
    );
  }, []);
  return (
    <div ref={ref} style={{ textAlign: "center", padding: "40px 20px", opacity: 0 }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px", fontSize: 32, color: "#fff",
        boxShadow: "0 0 0 12px rgba(99,102,241,0.1), 0 0 0 24px rgba(99,102,241,0.05)",
      }}>✓</div>
      <h2 style={{ color: "#111827", fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>Payment Successful</h2>
      <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
        ${parseFloat(amount).toFixed(2)} charged to •••• {cardLast4}
      </p>
      <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
        Confirmation sent to {email}
      </p>
      <Btn onClick={onReset} style={{ marginTop: 32, width: "auto", padding: "10px 28px" }}>
        New Payment
      </Btn>
    </div>
  );
}

const cardStyle = {
  margin: "0 auto", width: "100%", maxWidth: 440,
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #e5e7eb",
  padding: "28px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(99,102,241,0.04)",
  fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
};
const btnStyle = {
  width: "100%", padding: "13px", borderRadius: 12,
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "#fff", fontWeight: 700, fontSize: 14, border: "none", letterSpacing: "0.01em",
};
const ghostBtnStyle = {
  padding: "13px 20px", borderRadius: 12,
  background: "transparent",
  color: "#6b7280", fontWeight: 600, fontSize: 14,
  border: "1px solid #e5e7eb", whiteSpace: "nowrap",
};
const reviewBox = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 12, padding: "12px 16px",
};
const reviewLabel = {
  color: "#9ca3af", fontSize: 11, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px",
};
const reviewValue = { color: "#111827", fontSize: 14, fontWeight: 500, margin: 0 };
// src/pages/LandingPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// NOTE: we now use the same API helper as PlansPage
import { fetchPlans } from "../api/plansApi";
import "./LandingPage.css";

// Fallback data if API fails completely
const FALLBACK_PLANS = [
  {
    id: 1,
    name: "Free",
    slug: "free",
    price: 0,
    currency: "INR",
    billingCycle: "Forever",
    tagline: "Start quickly with core HR tools.",
    features: [
      "Employee directory",
      "Basic attendance tracking",
      "Single admin user",
      "Email support",
    ],
    isPopular: false,
  },
  {
    id: 2,
    name: "Basic",
    slug: "basic",
    price: 499,
    currency: "INR",
    billingCycle: "per month",
    tagline: "Perfect for growing teams.",
    features: [
      "Payroll processing",
      "Leave management",
      "Up to 25 employees",
      "Priority support",
    ],
    isPopular: true,
  },
  {
    id: 3,
    name: "Pro",
    slug: "pro",
    price: 1299,
    currency: "INR",
    billingCycle: "per month",
    tagline: "Advanced automation for HR & Payroll.",
    features: [
      "Advanced payroll rules",
      "Shift & roster planning",
      "Performance reviews",
      "API access",
    ],
    isPopular: false,
  },
  {
    id: 4,
    name: "Enterprise",
    slug: "enterprise",
    price: 9999,
    currency: "INR",
    billingCycle: "per month",
    tagline: "Custom HR suite for large organisations.",
    features: [
      "Unlimited employees",
      "Dedicated success manager",
      "Custom workflows & approvals",
      "On-prem / VPC deployment options",
    ],
    isPopular: false,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // -----------------------------
  // Fetch plans using SAME API as PlansPage
  // -----------------------------
  useEffect(() => {
    let alive = true;
    setLoadingPlans(true);

    fetchPlans()
      .then((data) => {
        if (!alive) return;

        const fetched = Array.isArray(data) ? data : [];

        if (fetched.length === 0) {
          console.warn("[LandingPage] fetchPlans returned empty array");
          // keep fallback plans
          return;
        }

        // 1) Normalize features object (same fields as PlansPage, but we’ll
        //    convert them into text bullets for the landing pricing cards)
        const normalizedBack = fetched.map((p, index) => {
          const f = p.features || {};

          const canUseAi = !!f.can_use_ai;
          const canEditProfile = !!f.can_edit_profile;
          const canChangePassword = !!f.can_change_password;
          const maxProjects =
            typeof f.max_projects === "number" ? f.max_projects : null;

          // Convert price_cents → rupees
          const cents = typeof p.price_cents === "number" ? p.price_cents : 0;
          const rupees =
            cents > 0 ? Math.round(cents / 100) : 0;

          // Turn features booleans into readable bullet points
          const featureLines = [];
          featureLines.push(
            canUseAi ? "AI chat available" : "No AI chat bot"
          );
          featureLines.push(
            canEditProfile ? "Can edit profile details" : "View-only profile"
          );
          featureLines.push(
            canChangePassword ? "Can change password" : "No password changes"
          );
          if (maxProjects !== null) {
            featureLines.push(`Max projects: ${maxProjects}`);
          }

          return {
            // base fields
            id: p.id ?? index,
            slug: p.slug || p.code || `plan-${index + 1}`,
            name:
              p.name || p.plan_name || p.slug || `Plan ${index + 1}`,
            description: p.description || "",
            price_cents: cents,
            billing_cycle: p.billing_cycle || "monthly",
            is_active: p.is_active !== false,

            // what landing page needs
            price: rupees,
            currency: p.currency || "INR",
            billingCycle: p.billing_cycle || "monthly",
            tagline: p.description || `${p.name || "Plan"} plan`,
            features: featureLines,
            isPopular: Boolean(p.is_popular),
          };
        });

        // 2) Add synthetic Free plan if backend doesn't have it (same behaviour idea as PlansPage)
        const hasFree = normalizedBack.some((p) => p.slug === "free");

        const freePlan = hasFree
          ? []
          : [
              {
                id: 0,
                slug: "free",
                name: "Free",
                description: "Free plan",
                price_cents: 0,
                price: 0,
                currency: "INR",
                billingCycle: "monthly",
                tagline: "Start with the basics at no cost.",
                features: [
                  "View profile details",
                  "Login & authentication",
                  "Basic access",
                ],
                isPopular: false,
              },
            ];

        const finalPlans = [...freePlan, ...normalizedBack];

        setPlans(finalPlans);
      })
      .catch((err) => {
        console.error("[LandingPage] fetchPlans error:", err);
        // on error: keep fallback plans
      })
      .finally(() => {
        if (alive) setLoadingPlans(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handlePlanClick = (plan) => {
    // For now: always go to register page
    navigate("/register", {
      state: { selectedPlan: plan.slug },
    });
  };

  const handleLogin = () => navigate("/login");
  const handleSignup = () => navigate("/register");

  return (
    <div className="landing-page">
      {/* Top Navigation */}
      <header className="lp-navbar">
        <div
          className="lp-logo"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
        >
          <span className="lp-logo-mark">N</span>
          <div className="lp-logo-text">
            <span className="lp-logo-title">Neonflake HR Suite</span>
            <span className="lp-logo-subtitle">Smart HR & Payroll Cloud</span>
          </div>
        </div>

        <nav className="lp-nav-links">
          <button
            className="lp-nav-link"
            onClick={() => {
              const el = document.getElementById("features");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Features
          </button>
          <button
            className="lp-nav-link"
            onClick={() => {
              const el = document.getElementById("pricing");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Pricing
          </button>
          <button
            className="lp-nav-link"
            onClick={() => {
              const el = document.getElementById("how-it-works");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            How it works
          </button>
        </nav>

        <div className="lp-auth-buttons">
          <button className="lp-btn lp-btn-ghost" onClick={handleLogin}>
            Log in
          </button>
          <button className="lp-btn lp-btn-primary" onClick={handleSignup}>
            Sign up
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="lp-main">
        <section className="lp-hero">
          <div className="lp-hero-text">
            <h1>
              Modern <span>HR & Payroll</span> for growing teams.
            </h1>
            <p>
              Neonflake HR Suite automates attendance, payroll, performance, and
              approvals – so your HR team can focus on people, not paperwork.
            </p>

            <div className="lp-hero-cta">
              <button className="lp-btn lp-btn-primary" onClick={handleSignup}>
                Start free trial
              </button>
              <button
                className="lp-btn lp-btn-outline"
                onClick={() => {
                  const el = document.getElementById("pricing");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                View plans
              </button>
            </div>

            <div className="lp-hero-stats">
              <div className="lp-stat">
                <span className="lp-stat-value">99.9%</span>
                <span className="lp-stat-label">Uptime SLA</span>
              </div>
              <div className="lp-stat">
                <span className="lp-stat-value">30 min</span>
                <span className="lp-stat-label">Payroll run</span>
              </div>
              <div className="lp-stat">
                <span className="lp-stat-value">3x</span>
                <span className="lp-stat-label">Faster HR ops</span>
              </div>
            </div>
          </div>

          <div className="lp-hero-panel">
            <div className="lp-hero-card">
              <h3>All-in-one HR dashboard</h3>
              <p>
                Centralise employees, attendance, payroll, and approvals in a
                clean, role-based dashboard.
              </p>
              <ul className="lp-hero-list">
                <li>✓ Employee self-service portal</li>
                <li>✓ Automated salary slips & TDS</li>
                <li>✓ Leave & holiday calendars</li>
                <li>✓ Role-based permissions (Admin / Manager / Employee)</li>
              </ul>
              <div className="lp-hero-card-footer">
                <span className="lp-badge">No credit card required</span>
                <span className="lp-badge lp-badge-soft">
                  14-day free trial
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="lp-section lp-features">
          <h2>Designed for HR, Finance & People teams</h2>
          <p className="lp-section-subtitle">
            From attendance to payroll compliance – everything in a single cloud
            platform.
          </p>

          <div className="lp-feature-grid">
            <div className="lp-feature-card">
              <h3>Smart HR Core</h3>
              <p>
                Maintain a single source of truth for your workforce – employee
                profiles, departments, reporting lines, and more.
              </p>
              <ul>
                <li>Central employee database</li>
                <li>Role & department mapping</li>
                <li>Attachments for documents (ID, contracts)</li>
              </ul>
            </div>
            <div className="lp-feature-card">
              <h3>Payroll & Compliance</h3>
              <p>
                Configure salary structures, handle statutory deductions, and
                generate payslips with one click.
              </p>
              <ul>
                <li>Custom salary components</li>
                <li>PF, ESI, TDS automation</li>
                <li>Bulk payroll processing</li>
              </ul>
            </div>
            <div className="lp-feature-card">
              <h3>Attendance & Leave</h3>
              <p>
                Track work hours, shifts, and leave balances with real-time,
                manager-friendly workflows.
              </p>
              <ul>
                <li>Leave policies & accruals</li>
                <li>Shift & roster management</li>
                <li>Manager approvals & history</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="lp-section lp-pricing">
          <h2>Simple, transparent pricing</h2>
          <p className="lp-section-subtitle">
            Choose a plan that fits your team today. Upgrade or downgrade
            anytime.
          </p>

          {loadingPlans && (
            <div className="lp-loading">Loading plans from server…</div>
          )}

          <div className="lp-pricing-grid">
            {(plans || []).map((plan) => {
              const priceNumber =
                typeof plan.price === "number" ? plan.price : 0;
              const safeFeatures = Array.isArray(plan.features)
                ? plan.features
                : [];

              return (
                <div
                  key={plan.id}
                  className={`lp-plan-card ${
                    plan.isPopular ? "lp-plan-popular" : ""
                  }`}
                >
                  {plan.isPopular && (
                    <div className="lp-plan-popular-badge">Most Popular</div>
                  )}

                  <h3>{plan.name}</h3>
                  <p className="lp-plan-tagline">{plan.tagline}</p>

                  <div className="lp-plan-price">
                    {priceNumber <= 0 ? (
                      <>
                        <span className="lp-plan-price-main">Free</span>
                        <span className="lp-plan-price-period">
                          {plan.billingCycle}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="lp-plan-currency">
                          {plan.currency === "INR"
                            ? "₹"
                            : (plan.currency || "") + " "}
                        </span>
                        <span className="lp-plan-price-main">
                          {priceNumber.toLocaleString("en-IN")}
                        </span>
                        <span className="lp-plan-price-period">
                          {plan.billingCycle}
                        </span>
                      </>
                    )}
                  </div>

                  <ul className="lp-plan-features">
                    {safeFeatures.map((feature, idx) => (
                      <li key={idx}>• {feature}</li>
                    ))}
                  </ul>

                  <button
                    className="lp-btn lp-btn-plan"
                    onClick={() => handlePlanClick(plan)}
                  >
                    Choose {plan.name}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="lp-pricing-footnote">
            All plans include secure hosting, role-based access control,
            activity logs, and audit-ready exports. Features shown above come
            directly from your subscription configuration in the backend.
          </p>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="lp-section lp-how">
          <h2>How Neonflake HR Suite works</h2>
          <div className="lp-how-grid">
            <div className="lp-how-step">
              <span className="lp-step-number">1</span>
              <h3>Sign up & choose a plan</h3>
              <p>
                Create your account in minutes, choose a subscription, and
                invite your HR & finance team members.
              </p>
            </div>
            <div className="lp-how-step">
              <span className="lp-step-number">2</span>
              <h3>Configure HR & payroll</h3>
              <p>
                Set up departments, roles, salary components, and leave
                policies. Import existing employee data via CSV.
              </p>
            </div>
            <div className="lp-how-step">
              <span className="lp-step-number">3</span>
              <h3>Run payroll & automate workflows</h3>
              <p>
                Run payroll, generate payslips, and track attendance & leave –
                all from a single, secure dashboard.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-left">
          <span className="lp-footer-brand">
            © {new Date().getFullYear()} Neonflake HR Suite.
          </span>
          <span className="lp-footer-text">Built for modern HR teams.</span>
        </div>
        <div className="lp-footer-links">
          <button className="lp-footer-link" onClick={handleLogin}>
            Log in
          </button>
          <button className="lp-footer-link" onClick={handleSignup}>
            Sign up
          </button>
        </div>
      </footer>
    </div>
  );
}

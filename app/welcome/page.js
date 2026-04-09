export const metadata = {
  title: 'Welcome to The Legacy Link',
  description: 'You just made a powerful decision. Watch this message from our Founder.',
};

export default function WelcomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0B1020',
      color: '#E6D1A6',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      padding: '0',
      margin: '0',
    }}>
      {/* Top brand label */}
      <div style={{
        textAlign: 'center',
        paddingTop: '48px',
        paddingBottom: '8px',
        letterSpacing: '0.25em',
        fontSize: '11px',
        fontWeight: '700',
        color: '#C8A96B',
        textTransform: 'uppercase',
      }}>
        THE LEGACY LINK
      </div>

      {/* Main content container */}
      <div style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: '0 24px 80px',
      }}>

        {/* Headline */}
        <h1 style={{
          textAlign: 'center',
          fontSize: 'clamp(36px, 8vw, 64px)',
          fontWeight: '800',
          margin: '24px 0 12px',
          lineHeight: '1.1',
          background: 'linear-gradient(135deg, #E6D1A6 0%, #C8A96B 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Welcome to the Family.
        </h1>

        {/* Subheadline */}
        <p style={{
          textAlign: 'center',
          fontSize: 'clamp(15px, 3vw, 19px)',
          color: '#94a3b8',
          margin: '0 0 40px',
          lineHeight: '1.6',
          maxWidth: '520px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          You just made a powerful decision. Watch this message from our Founder.
        </p>

        {/* Loom Video Embed */}
        <div style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%', /* 16:9 */
          height: '0',
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid rgba(200, 169, 107, 0.2)',
          boxShadow: '0 0 60px rgba(200, 169, 107, 0.08)',
          marginBottom: '56px',
          backgroundColor: '#0d1428',
        }}>
          <iframe
            src="https://www.loom.com/embed/e1f7fe2290d24b539c4786fb6bf9b6bb"
            frameBorder="0"
            allowFullScreen
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '16px',
            }}
            title="Welcome message from our Founder"
          />
        </div>

        {/* Next Steps section */}
        <div style={{ marginBottom: '64px' }}>
          <h2 style={{
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#C8A96B',
            marginBottom: '28px',
          }}>
            Your Next 3 Steps
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Step 1 */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '20px',
              background: 'rgba(200, 169, 107, 0.04)',
              border: '1px solid rgba(200, 169, 107, 0.15)',
              borderRadius: '14px',
              padding: '24px',
            }}>
              <div style={{
                flexShrink: '0',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #C8A96B, #E6D1A6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '800',
                color: '#0B1020',
                lineHeight: '1',
              }}>
                1
              </div>
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#E6D1A6',
                  marginBottom: '6px',
                }}>
                  Sign Your ICA
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#64748b',
                  lineHeight: '1.6',
                }}>
                  If you haven&apos;t signed your Independent Contractor Agreement yet, complete it now to unlock your back office.
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '20px',
              background: 'rgba(200, 169, 107, 0.04)',
              border: '1px solid rgba(200, 169, 107, 0.15)',
              borderRadius: '14px',
              padding: '24px',
            }}>
              <div style={{
                flexShrink: '0',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #C8A96B, #E6D1A6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '800',
                color: '#0B1020',
                lineHeight: '1',
              }}>
                2
              </div>
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#E6D1A6',
                  marginBottom: '6px',
                }}>
                  Book Your Onboarding Call
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#64748b',
                  lineHeight: '1.6',
                }}>
                  Your upline will reach out shortly. Watch for an email with your booking link.
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '20px',
              background: 'rgba(200, 169, 107, 0.04)',
              border: '1px solid rgba(200, 169, 107, 0.15)',
              borderRadius: '14px',
              padding: '24px',
            }}>
              <div style={{
                flexShrink: '0',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #C8A96B, #E6D1A6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '800',
                color: '#0B1020',
                lineHeight: '1',
              }}>
                3
              </div>
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#E6D1A6',
                  marginBottom: '6px',
                }}>
                  Access Your Back Office
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#64748b',
                  lineHeight: '1.6',
                }}>
                  Log in at <span style={{ color: '#C8A96B', fontWeight: '600' }}>innercirclelink.com/start</span> to begin your onboarding steps.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          borderTop: '1px solid rgba(200, 169, 107, 0.1)',
          paddingTop: '32px',
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '800',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: '8px',
          }}>
            THE LEGACY LINK
          </div>
          <div style={{
            fontSize: '11px',
            color: '#374151',
          }}>
            © {new Date().getFullYear()} The Legacy Link. All rights reserved.
          </div>
        </div>

      </div>
    </div>
  );
}

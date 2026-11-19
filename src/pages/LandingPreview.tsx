import { useNavigate } from 'react-router-dom';
import { PublicLanding } from '@/components/landing/PublicLanding';

/**
 * Development-only visual review of the public landing page.
 * It does not read or change the signed-in session.
 * Login and registration continue into the existing /auth flow.
 */
export function LandingPreview() {
  const navigate = useNavigate();
  return (
    <PublicLanding
      onSignIn={() => navigate('/auth', { state: { authTab: 'signin' } })}
      onSignUp={() => navigate('/auth', { state: { authTab: 'signup' } })}
    />
  );
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import * as AuthContextModule from '../../context/AuthContext';

describe('LoginPage', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      isAdmin: false,
      isFaculty: false,
      isStudent: false,
      role: null,
      login: mockLogin,
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
  };

  it('renders essential login form elements', () => {
    renderComponent();

    expect(screen.getByText('CampusTime Portal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. admin or faculty/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter account password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Portal/i })).toBeInTheDocument();
  });

  it('does NOT render Quick Demo Credentials or demo autofill buttons', () => {
    renderComponent();

    expect(screen.queryByText(/Quick Demo Credentials/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Admin$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Faculty$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Student$/i })).not.toBeInTheDocument();
  });

  it('submits manual login credentials to auth context', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderComponent();

    const usernameInput = screen.getByPlaceholderText(/e\.g\. admin or faculty/i);
    const passwordInput = screen.getByPlaceholderText(/Enter account password/i);
    const submitButton = screen.getByRole('button', { name: /Sign In to Portal/i });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'SecurePass123!');
    });
  });

  it('displays error message when login fails with 401', async () => {
    mockLogin.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { detail: 'No active account found with the given credentials' },
      },
    });

    renderComponent();

    const usernameInput = screen.getByPlaceholderText(/e\.g\. admin or faculty/i);
    const passwordInput = screen.getByPlaceholderText(/Enter account password/i);
    const submitButton = screen.getByRole('button', { name: /Sign In to Portal/i });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPass' } });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText('Invalid username or password. Please verify credentials.')
    ).toBeInTheDocument();
  });
});

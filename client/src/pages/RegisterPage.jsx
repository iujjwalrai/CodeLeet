import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { API_BASE_URL } from "../api/urls";
import { useForm } from "react-hook-form";
import AuthLayout, { GoogleMark, OrDivider } from "../components/AuthLayout";
import toast from "react-hot-toast";

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();


  const handleGoogleAuth = () => {
    window.location.href =
      API_BASE_URL + "/api/auth/google";
  };


  const onRegister = async (data) => {
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      const { confirmPassword, ...payload } = data;
      await axios.post("/api/auth/register", payload);
      toast.success("Account created! Please log in.");
      navigate("/login");
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Registration failed";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start solving in under a minute."
      footer={<>
        Already have an account?{" "}
        <span
          className="cursor-pointer font-medium text-accent hover:underline"
          onClick={() => navigate("/login")}
        >
          Login
        </span>
      </>}
    >
          {/* Google Signup */}
          <button
            onClick={handleGoogleAuth}
            className="btn btn-secondary w-full"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <OrDivider />

          {/* FORM START */}
          <form onSubmit={handleSubmit(onRegister)} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="label mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                {...register("fullName", { required: "Name is required" })}
                className="field"
              />
              {errors.fullName && (
                <p className="mt-1.5 text-xs text-bad">{errors.fullName.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="label mb-1.5">Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: "Invalid email"
                  }
                })}
                className="field"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-bad">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="label mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  {...register("password", {
                    required: "Password is required",
                    minLength: {
                      value: 6,
                      message: "Minimum 6 characters"
                    }
                  })}
                  className="field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-faint hover:text-fg"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-bad">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  {...register("confirmPassword", {
                    required: "Confirm your password"
                  })}
                  className="field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-faint hover:text-fg"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-bad">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account…
                </>
              ) : "Create Account"}
            </button>
          </form>
    </AuthLayout>
  );
};

export default RegisterPage;

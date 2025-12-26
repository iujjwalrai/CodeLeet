import React, { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Chrome } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { useForm } from "react-hook-form";

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();


  const handleGoogleAuth = () => {
    window.location.href =
      import.meta.env.VITE_API_BASE_URL + "/api/auth/google";
  };


  const onRegister = async (data) => {
    try {
      // optional: remove confirmPassword before sending
      const { confirmPassword, ...payload } = data;

      const response = await axios.post("/api/auth/register", payload);
      console.log(response.data);

      navigate("/login");
    } catch (error) {
      console.error(error.response?.data || error.message);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0A] px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[#111111] p-8 rounded-2xl shadow-xl border border-white/10"
      >
        <h2 className="text-3xl font-semibold text-white text-center mb-8">
          Create Account
        </h2>

        {/* FORM START */}
        <form onSubmit={handleSubmit(onRegister)}>
          {/* Full Name */}
          <div className="mb-5">
            <label className="text-gray-300 text-sm mb-2 block">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
              {...register("fullName", { required: "Name is required" })}
              className="w-full p-3 bg-[#1A1A1A] rounded-xl text-white outline-none"
            />
            {errors.name && (
              <p className="text-red-400 text-sm mt-1">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="mb-5">
            <label className="text-gray-300 text-sm mb-2 block">
              Email
            </label>
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
              className="w-full p-3 bg-[#1A1A1A] rounded-xl text-white outline-none"
            />
            {errors.email && (
              <p className="text-red-400 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mb-5">
            <label className="text-gray-300 text-sm mb-2 block">
              Password
            </label>
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
                className="w-full p-3 bg-[#1A1A1A] rounded-xl text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="text-gray-300 text-sm mb-2 block">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your password"
                {...register("confirmPassword", {
                  required: "Confirm your password"
                })}
                className="w-full p-3 bg-[#1A1A1A] rounded-xl text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-3 text-gray-400"
              >
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-xl font-medium mb-4"
          >
            Create Account
          </motion.button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px bg-white/10 flex-grow" />
          <span className="text-gray-400 text-sm">OR</span>
          <div className="h-px bg-white/10 flex-grow" />
        </div>

        {/* Google Signup */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 bg-[#1A1A1A] hover:bg-[#242424] transition p-3 rounded-xl border border-white/10 text-white"
        >
          <Chrome size={20} />
          Continue with Google
        </motion.button>


        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{" "}
          <span
            className="text-purple-400 cursor-pointer hover:underline"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterPage;

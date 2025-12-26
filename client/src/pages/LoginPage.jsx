import React, { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Chrome } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {useForm} from "react-hook-form"
import axios from "../api/axios"
const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
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


  const onLogin = async(data)=>{
    try{
      console.log(data)
      const response = await axios.post("/api/auth/login", data);
      console.log(response.data);
      if(response.data)
      navigate("/dashboard");
    }
    catch(e){
      console.error(e.response?.data || e.message);
    }
  }
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0A] px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[#111111] p-8 rounded-2xl shadow-xl border border-white/10"
      >
        <h2 className="text-3xl font-semibold text-white text-center mb-8">
          Welcome Back
        </h2>


        <form onSubmit={handleSubmit(onLogin)}>
            {/* Email */}
          <div className="mb-5">
            <label className="text-gray-300 text-sm mb-2 block">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full p-3 bg-[#1A1A1A] rounded-xl text-white outline-none border border-transparent focus:border-purple-500 transition"
             {...register("email", {required: "Email is required"})}/>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="text-gray-300 text-sm mb-2 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full p-3 bg-[#1A1A1A] rounded-xl text-white outline-none border border-transparent focus:border-purple-500 transition"
              {...register("password", {required: "Password is required"})}/>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <motion.button
            type="submit"
            whileTap={{ scale: 0.95 }}
            className="w-full bg-purple-600 hover:bg-purple-700 transition text-white p-3 rounded-xl font-medium mb-4"
          >
            Login
          </motion.button>
        </form>
        

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px bg-white/10 flex-grow" />
          <span className="text-gray-400 text-sm">OR</span>
          <div className="h-px bg-white/10 flex-grow" />
        </div>

        {/* Google Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 bg-[#1A1A1A] hover:bg-[#242424] transition p-3 rounded-xl border border-white/10 text-white"
        >
          <Chrome size={20} />
          Continue with Google
        </motion.button>


        <p className="text-center text-gray-500 text-sm mt-6">
          Don’t have an account?{" "}
          <span className="text-purple-400 cursor-pointer hover:underline" onClick={()=>navigate("/register")}>
            Sign up
          </span>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;

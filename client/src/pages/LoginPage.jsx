import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {useForm} from "react-hook-form"
import axios from "../api/axios"
import { API_BASE_URL } from "../api/urls";
import { useAuth } from "../context/AuthContext";
import AuthLayout, { GoogleMark, OrDivider } from "../components/AuthLayout";
import toast from "react-hot-toast";
const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const {setUser} = useAuth();
  const {
      register,
      handleSubmit,
      formState: { errors }
    } = useForm();

  const handleGoogleAuth = () => {
    window.location.href =
      API_BASE_URL + "/api/auth/google";
  };


  const onLogin = async(data)=>{
    setIsLoading(true);
    try{
      const response = await axios.post("/api/auth/login", data);
      if(response.data){
        setUser(response.data.user);
        toast.success("Welcome back");
        navigate("/dashboard");
      }
    }
    catch(e){
      const msg = e.response?.data?.message || e.message || "Login failed";
      toast.error(msg);
    }
    finally{
      setIsLoading(false);
    }
  }
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue solving."
      footer={<>
        Don’t have an account?{" "}
        <span className="cursor-pointer font-medium text-accent hover:underline" onClick={()=>navigate("/register")}>
          Sign up
        </span>
      </>}
    >
        {/* Google Button */}
        <button
          onClick={handleGoogleAuth}
          className="btn btn-secondary w-full"
        >
          <GoogleMark />
          Continue with Google
        </button>

        <OrDivider />

        <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
            {/* Email */}
          <div>
            <label className="label mb-1.5">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              className="field"
             {...register("email", {required: "Email is required"})}/>
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
                placeholder="Enter your password"
                className="field pr-10"
              {...register("password", {required: "Password is required"})}/>
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

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Logging in…
              </>
            ) : "Login"}
          </button>
        </form>
    </AuthLayout>
  );
};

export default LoginPage;

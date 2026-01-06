import React from 'react'
import { Code2} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const Navbar = () => {
  const naviagte = useNavigate();  
  const {user} = useAuth();
  return (
    <nav className="border-b border-white/10 bg-[#111111]/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 cursor-pointer">
            <div className="flex items-center gap-2" onClick={()=>naviagte("/")}>
              <Code2 className="text-purple-500" size={28} />
              <span className="text-2xl font-bold">CodeLeet</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-300 hover:text-white transition px-4 py-2" onClick={()=> naviagte("/problems")}>
                Problems
              </button>
              {
                !user ? (<button className="bg-purple-600 hover:bg-purple-700 transition px-6 py-2 rounded-xl font-medium" onClick={()=>naviagte("/login")}>
                Sign In
              </button>) : (<button className="bg-purple-600 hover:bg-purple-700 transition px-6 py-2 rounded-xl font-medium" onClick={()=>naviagte("/dashboard")}>
                Dashboard
              </button>)
              }
              
            </div>
          </div>
        </div>
      </nav>
  )
}

export default Navbar
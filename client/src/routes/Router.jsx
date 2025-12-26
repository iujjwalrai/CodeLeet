import React from 'react'
import { Route } from 'react-router-dom'
import { Routes } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import DashboardPage from '../pages/DashboardPage'
import ProblemsPage from '../pages/ProblemsPage'
import ProblemSolvingPage from "../pages/ProblemSolvingPage"
import Home from '../pages/Home'
import OAuthSuccess from '../pages/OAuthSuccess'
const Router = () => {
  return (
    <Routes>
        <Route path='/' element={<Home/>}></Route>
        <Route path='/login' element={<LoginPage/>}></Route>
        <Route path='/register' element={<RegisterPage/>}></Route>
        <Route path='/dashboard' element={<DashboardPage/>}></Route>
        <Route path='/problems' element={<ProblemsPage/>}></Route>
        <Route path="/problem/*" element={<ProblemSolvingPage />} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
    </Routes>
  )
}

export default Router
import { useState } from 'react';

const ModernDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Sample landing pages data
  const landingPages = [
    {
      id: 1,
      name: "New Meditation Album",
      views: "178",
      clicks: "53",
      impact: "API and Navigation",
      status: "active",
      actions: ["edit", "preview"]
    },
    {
      id: 2,
      name: "Fitness Training Program",
      views: "243",
      clicks: "47",
      impact: "Lead Generation",
      status: "inactive",
      actions: ["edit", "preview"]
    },
    {
      id: 3,
      name: "Summer Sale Collection",
      views: "312",
      clicks: "61",
      impact: "Product Showcase",
      status: "active",
      actions: ["edit", "preview"]
    }
  ];
  
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg border-r border-gray-200 ${sidebarOpen ? 'w-48' : 'w-20'} transition-all duration-300 ease-in-out`} 
           style={{ boxShadow: '2px 0 10px rgba(0, 0, 0, 0.05)' }}>
        <div className="p-4">
          {sidebarOpen && <h2 className="text-xl font-medium text-gray-800">Dashboard</h2>}
        </div>
        
        <nav className="mt-6">
          <SidebarItem text="Dashboard" active={true} expanded={sidebarOpen} />
          <SidebarItem text="Apps" expanded={sidebarOpen} />
        </nav>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-white border-b border-gray-200" style={{ boxShadow: '0 2px 5px rgba(0, 0, 0, 0.05)' }}>
          <div className="px-4 py-3 flex items-center justify-end">
            <div className="relative">
              <button 
                className="h-10 w-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 font-medium cursor-pointer hover:border-indigo-500 transition-all duration-200"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
              >
                <span className="text-sm">JS</span>
              </button>
              
              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10"
                     style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Account Settings</a>
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Your Plan</a>
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</a>
                </div>
              )}
            </div>
          </div>
        </header>
        
        {/* Dashboard Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Activity Chart */}
            <div className="bg-white rounded-lg overflow-hidden" 
                 style={{ boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)', transform: 'translateY(-1px)' }}>
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-800 mb-4">Activity chart</h2>
                
                <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center mb-6"
                     style={{ boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                  <div className="relative w-full h-full">
                    {/* Simplified Chart */}
                    <svg className="w-full h-full" viewBox="0 0 500 160">
                      {/* Grid lines */}
                      <line x1="0" y1="0" x2="500" y2="0" stroke="#eee" strokeWidth="1" />
                      <line x1="0" y1="40" x2="500" y2="40" stroke="#eee" strokeWidth="1" />
                      <line x1="0" y1="80" x2="500" y2="80" stroke="#eee" strokeWidth="1" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="#eee" strokeWidth="1" />
                      <line x1="0" y1="160" x2="500" y2="160" stroke="#eee" strokeWidth="1" />
                      
                      {/* Activity line */}
                      <path 
                        d="M20,120 C50,110 100,130 150,80 S250,40 300,60 S400,30 480,50" 
                        stroke="#6366F1" 
                        strokeWidth="3" 
                        fill="none"
                      />
                      
                      {/* Activity points */}
                      <circle cx="20" cy="120" r="4" fill="#6366F1" />
                      <circle cx="100" cy="130" r="4" fill="#6366F1" />
                      <circle cx="150" cy="80" r="4" fill="#6366F1" />
                      <circle cx="250" cy="40" r="4" fill="#6366F1" />
                      <circle cx="300" cy="60" r="4" fill="#6366F1" />
                      <circle cx="400" cy="30" r="4" fill="#6366F1" />
                      <circle cx="480" cy="50" r="4" fill="#6366F1" />
                    </svg>
                  </div>
                </div>
                
                {/* Total Views and Clicks Side by Side */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg transition-all duration-200" 
                       style={{ boxShadow: '0 2px 5px rgba(0, 0, 0, 0.08)', transform: 'translateY(-1px)' }}>
                    <p className="text-sm text-gray-500 mb-1">Total views</p>
                    <p className="text-2xl font-semibold">12,874</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg transition-all duration-200"
                       style={{ boxShadow: '0 2px 5px rgba(0, 0, 0, 0.08)', transform: 'translateY(-1px)' }}>
                    <p className="text-sm text-gray-500 mb-1">Total clicks</p>
                    <p className="text-2xl font-semibold">39,649</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Landing Pages */}
            <div className="bg-white rounded-lg overflow-hidden"
                 style={{ boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)', transform: 'translateY(-1px)' }}>
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-800">Landing pages</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center">
                          <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                          <span className="ml-3">Page name</span>
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">App Effect</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Live</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Edit</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {landingPages.map((page) => (
                      <tr key={page.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                            <span className="ml-3 text-sm text-gray-900">{page.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex justify-center space-x-3">
                            <div className="bg-gray-100 rounded px-3 py-1.5 text-xs font-medium text-gray-700"
                                 style={{ boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                              Views: {page.views}
                            </div>
                            <div className="bg-gray-100 rounded px-3 py-1.5 text-xs font-medium text-gray-700"
                                 style={{ boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                              Clicks: {page.clicks}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {page.impact}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center rounded-full h-3 w-3 ${page.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}
                                style={{ boxShadow: page.status === 'active' ? '0 0 4px rgba(16, 185, 129, 0.4)' : 'none' }}></span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <a href="#" className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded"
                             style={{ boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)', transform: 'translateY(-1px)' }}>
                            EDIT
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <a href="#" className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded"
                             style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)', transform: 'translateY(-1px)' }}>
                            PREVIEW
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// Component for sidebar items
const SidebarItem = ({ text, active = false, expanded = true }) => {
  return (
    <div className={`flex items-center px-4 py-3 cursor-pointer transition-colors duration-200 ${active ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'}`}>
      <span className={`${expanded ? 'block' : 'hidden'}`}>{text}</span>
    </div>
  );
};

export default ModernDashboard;
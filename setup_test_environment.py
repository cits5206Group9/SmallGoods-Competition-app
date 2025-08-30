#!/usr/bin/env python3
"""
Setup script for Small Goods Competition Frontend Testing
This script helps set up and launch the testing environment
"""

import os
import sys
import subprocess
import webbrowser
import time
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 6):
        print("❌ Python 3.6+ is required")
        return False
    print(f"✅ Python {sys.version.split()[0]} detected")
    return True

def check_flask_installation():
    """Check if Flask is installed, offer to install if not"""
    try:
        import flask
        print(f"✅ Flask {flask.__version__} is installed")
        return True
    except ImportError:
        print("⚠️  Flask is not installed")
        response = input("Would you like to install Flask? (y/n): ").lower()
        if response in ['y', 'yes']:
            print("📦 Installing Flask...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", "flask"])
                print("✅ Flask installed successfully")
                return True
            except subprocess.CalledProcessError:
                print("❌ Failed to install Flask")
                return False
        return False

def setup_frontend_structure():
    """Ensure frontend directory structure is correct"""
    frontend_dir = Path("frontend")
    
    required_dirs = [
        "templates",
        "static/css",
        "static/css/pages", 
        "static/js",
        "static/js/modules",
        "static/js/pages",
        "static/js/components",
        "static/images"
    ]
    
    required_files = [
        "templates/base.html",
        "templates/admin.html", 
        "templates/referee.html",
        "static/css/base.css",
        "static/css/layout.css",
        "static/css/components.css",
        "static/js/app.js",
        "static/js/modules/state-manager.js",
        "static/service-worker.js",
        "static/manifest.json"
    ]
    
    missing_items = []
    
    # Check directories
    for dir_path in required_dirs:
        full_path = frontend_dir / dir_path
        if not full_path.exists():
            missing_items.append(f"Directory: {dir_path}")
    
    # Check files  
    for file_path in required_files:
        full_path = frontend_dir / file_path
        if not full_path.exists():
            missing_items.append(f"File: {file_path}")
    
    if missing_items:
        print("⚠️  Missing frontend components:")
        for item in missing_items[:5]:  # Show first 5
            print(f"   - {item}")
        if len(missing_items) > 5:
            print(f"   ... and {len(missing_items) - 5} more")
        return False
    
    print("✅ Frontend structure is complete")
    return True

def launch_test_options():
    """Present testing options to user"""
    print("\n" + "="*60)
    print("🏋️  SMALL GOODS COMPETITION FRONTEND TESTING")
    print("="*60)
    print("\nChoose a testing option:\n")
    
    print("1. 🚀 Flask Test Server (Full functionality)")
    print("   - Complete API simulation")
    print("   - Real-time features") 
    print("   - All user interfaces")
    print("   - Mock data and interactions\n")
    
    print("2. 🌐 Static HTML Preview (Quick visual review)")
    print("   - Admin dashboard preview")
    print("   - Referee interface preview")
    print("   - Basic interactions")
    print("   - No server required\n")
    
    print("3. 📱 Simple HTTP Server (PWA testing)")
    print("   - Service Worker testing")
    print("   - PWA installation")
    print("   - Offline functionality")
    print("   - Basic file serving\n")
    
    print("4. 📖 View Documentation")
    print("   - Testing guide")
    print("   - Setup instructions")
    print("   - Feature overview\n")
    
    print("5. ❌ Exit\n")
    
    while True:
        choice = input("Enter your choice (1-5): ").strip()
        
        if choice == "1":
            return launch_flask_server()
        elif choice == "2":
            return launch_static_preview()
        elif choice == "3":
            return launch_http_server()
        elif choice == "4":
            return show_documentation()
        elif choice == "5":
            print("👋 Goodbye!")
            return True
        else:
            print("❌ Invalid choice. Please enter 1-5.")

def launch_flask_server():
    """Launch the Flask test server"""
    print("\n🚀 Starting Flask test server...")
    
    if not check_flask_installation():
        return False
    
    frontend_dir = Path("frontend")
    server_file = frontend_dir / "test_server.py"
    
    if not server_file.exists():
        print(f"❌ Test server file not found: {server_file}")
        return False
    
    print("🌐 Server will be available at:")
    print("   Admin:      http://localhost:5000/admin")
    print("   Referee:    http://localhost:5000/ref") 
    print("   Timekeeper: http://localhost:5000/tc")
    print("   Athlete:    http://localhost:5000/athlete")
    print("   Display:    http://localhost:5000/display")
    print("   Network:    http://localhost:5000/network")
    print("\n⏳ Starting server...")
    
    # Change to frontend directory and run server
    os.chdir("frontend")
    
    # Open browser after a short delay
    def open_browser():
        time.sleep(2)
        webbrowser.open("http://localhost:5000/admin")
    
    import threading
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    try:
        subprocess.run([sys.executable, "test_server.py"])
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Error running server: {e}")
    
    return True

def launch_static_preview():
    """Launch static HTML preview"""
    print("\n🌐 Opening static HTML preview...")
    
    frontend_dir = Path("frontend")
    admin_preview = frontend_dir / "preview-admin.html"
    referee_preview = frontend_dir / "preview-referee.html"
    
    if admin_preview.exists():
        webbrowser.open(f"file://{admin_preview.absolute()}")
        print("✅ Admin preview opened in browser")
    
    if referee_preview.exists():
        time.sleep(1)
        webbrowser.open(f"file://{referee_preview.absolute()}")
        print("✅ Referee preview opened in browser")
    
    print("\n📝 Note: Static previews have limited functionality")
    print("   Use Flask server option for full testing")
    
    input("\nPress Enter to continue...")
    return True

def launch_http_server():
    """Launch simple HTTP server for PWA testing"""
    print("\n📱 Starting simple HTTP server...")
    
    frontend_dir = Path("frontend")
    
    print("🌐 Server will be available at:")
    print("   http://localhost:8000/preview-admin.html")
    print("   http://localhost:8000/preview-referee.html")
    print("\n⏳ Starting server...")
    
    os.chdir("frontend")
    
    # Open browser after delay
    def open_browser():
        time.sleep(2)
        webbrowser.open("http://localhost:8000/preview-admin.html")
    
    import threading
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    try:
        subprocess.run([sys.executable, "-m", "http.server", "8000"])
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Error running server: {e}")
    
    return True

def show_documentation():
    """Show documentation options"""
    print("\n📖 Documentation Options:")
    print("1. Testing Guide (TESTING.md)")
    print("2. Frontend README (README.md)")
    print("3. Project Todo (todo.md)")
    print("4. Back to main menu")
    
    while True:
        choice = input("\nEnter choice (1-4): ").strip()
        
        files = {
            "1": Path("frontend/TESTING.md"),
            "2": Path("frontend/README.md"), 
            "3": Path("todo.md")
        }
        
        if choice in files:
            file_path = files[choice]
            if file_path.exists():
                # Try to open with default system app
                try:
                    if sys.platform == "win32":
                        os.startfile(str(file_path))
                    elif sys.platform == "darwin":  # macOS
                        subprocess.run(["open", str(file_path)])
                    else:  # Linux
                        subprocess.run(["xdg-open", str(file_path)])
                    print(f"✅ Opened {file_path.name}")
                except Exception:
                    print(f"📄 Content of {file_path.name}:")
                    print("-" * 40)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            # Show first 50 lines
                            lines = content.split('\n')[:50]
                            print('\n'.join(lines))
                            if len(content.split('\n')) > 50:
                                print("\n... (file continues)")
                    except Exception as e:
                        print(f"❌ Could not read file: {e}")
            else:
                print(f"❌ File not found: {file_path}")
            break
        elif choice == "4":
            return True
        else:
            print("❌ Invalid choice. Please enter 1-4.")
    
    input("\nPress Enter to continue...")
    return True

def main():
    """Main setup function"""
    print("🏋️  Small Goods Competition Frontend Setup")
    print("=" * 50)
    
    # Basic checks
    if not check_python_version():
        input("Press Enter to exit...")
        return
    
    # Check if we're in the right directory
    if not Path("frontend").exists():
        print("❌ Frontend directory not found")
        print("   Please run this script from the project root directory")
        input("Press Enter to exit...")
        return
    
    # Check frontend structure
    if not setup_frontend_structure():
        print("\n💡 Make sure you've completed the frontend build process")
        print("   See the project documentation for setup instructions")
        input("Press Enter to exit...")
        return
    
    # Show options
    launch_test_options()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Setup cancelled by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        input("Press Enter to exit...")
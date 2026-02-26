import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRealtimeStore, type Notification } from '../stores/realtime';

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { notifications, markNotificationRead, clearNotifications } = useRealtimeStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleNotificationClick(notification: Notification) {
    markNotificationRead(notification.id);
    setIsOpen(false);
  }

  function getNotificationIcon(type: Notification['type']) {
    switch (type) {
      case 'analysis_complete':
        return <CheckCircle className="text-green-500" size={18} />;
      case 'analysis_failed':
        return <AlertTriangle className="text-red-500" size={18} />;
      case 'critical_risk':
        return <AlertTriangle className="text-orange-500" size={18} />;
      default:
        return <Bell className="text-keelo-500" size={18} />;
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-dark-400 hover:text-dark-200 transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-keelo-500 rounded-full text-xs text-white flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-dark-900 border border-dark-700 rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-800">
              <h3 className="font-semibold text-dark-100">Notificações</h3>
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-xs text-dark-400 hover:text-red-400 flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Limpar
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-10 h-10 mx-auto text-dark-600 mb-3" />
                  <p className="text-dark-400 text-sm">Nenhuma notificação</p>
                  <p className="text-dark-500 text-xs mt-1">
                    Notificações de análises aparecerão aqui
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-800">
                  {notifications.slice(0, 10).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-dark-800/50 transition-colors cursor-pointer ${
                        !notification.read ? 'bg-keelo-500/5' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${notification.read ? 'text-dark-300' : 'text-dark-100 font-medium'}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-dark-400 mt-0.5 truncate">
                            {notification.message}
                          </p>
                          <p className="text-xs text-dark-500 mt-1">
                            {formatDistanceToNow(new Date(notification.timestamp), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        {notification.analysisId && (
                          <Link
                            to={`/analyses/${notification.analysisId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                            className="p-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-400 hover:text-keelo-400"
                          >
                            <ExternalLink size={14} />
                          </Link>
                        )}
                      </div>
                      {!notification.read && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-keelo-500 rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 10 && (
              <div className="px-4 py-2 border-t border-dark-700 bg-dark-800">
                <p className="text-xs text-dark-400 text-center">
                  +{notifications.length - 10} notificações anteriores
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


import { X, Shield } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Shield size={18} className="text-blue-500" />
            </div>
            <h2 className="text-base font-black text-slate-800 dark:text-gray-100 tracking-tight">用户协议与隐私政策</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-600 dark:text-gray-300 leading-relaxed space-y-5">
          <h3 className="text-lg font-black text-slate-800 dark:text-gray-100 text-center">
            ALIBI LOG 个人项目用户协议与隐私政策
          </h3>
          <p className="text-xs text-gray-400 text-center">最后更新日期：2026年3月22日</p>

          <section className="space-y-2">
            <h4 className="text-sm font-black text-slate-700 dark:text-gray-200">1. 特别申明：项目性质</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>非营利性：</strong>ALIBI LOG（以下简称"本站"）是一个由个人开发者出于学术研究、技术交流及兴趣爱好开发的私人技术演示项目。</li>
              <li><strong>无商业化：</strong>本站不包含任何形式的广告推广、付费服务或数据变现逻辑。</li>
              <li><strong>非公众产品：</strong>本站目前仅供开发者自用及特定受众（如朋友、技术同行）进行交互演示，不属于《高德地图开放平台服务协议》中所定义的"商业目的"或"公众服务产品"。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-black text-slate-700 dark:text-gray-200">2. 地图服务与知识产权说明</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>服务来源：</strong>本站所调用的地图显示、地点联想及地理编码服务均由<strong>高德地图（AutoNavi）</strong>提供。</li>
              <li><strong>权利归属：</strong>所有地图底图、POI（地点）数据、品牌标志及其相关的知识产权均归属于北京高德图强科技有限公司及其关联方。本站仅在 API 授权范围内进行调用。</li>
              <li><strong>严禁滥用：</strong>用户不得利用本站接口进行非法抓取、逆向工程或大规模自动化请求，否则由此产生的法律责任由用户自行承担。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-black text-slate-700 dark:text-gray-200">3. 隐私保护与数据流转</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>本地存储：</strong>本站优先采用本地存储（如 LocalStorage）或受保护的私有数据库。您的"感想"、"评分"、"标签"等私人评价内容不会同步给高德或其他第三方。</li>
              <li><strong>地理位置数据：</strong>当您使用"自动定位"功能时，本站会通过浏览器的 Geolocation API <strong>请求您的设备定位权限</strong>，以获取精确的地理坐标（经纬度）。该坐标将发送至高德地图服务器进行逆地理编码（将坐标转换为省/市地名）。若您拒绝授权或设备不支持定位，系统将自动回退至基于 IP 地址的城市级粗略定位。<strong>本站不会存储您的实时 GPS 坐标数据</strong>，仅保留您选择的城市/地点名称。当您使用"搜索店名"功能时，查询关键词将发送至高德服务器以获取联想结果。</li>
              <li><strong>不追踪原则：</strong>本站不会记录或存储您的实时行动轨迹。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-black text-slate-700 dark:text-gray-200">4. 免责声明（重要）</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>准确性风险：</strong>由于地图数据存在滞后性或技术处理误差，本站展示的地点、坐标、人均价格等信息仅供参考。请勿将本站信息作为行驶、导航、专业决策的唯一依据。</li>
              <li><strong>技术稳定性：</strong>作为一个个人实验项目，本站不承诺 7x24 小时的稳定性。因服务器迁移、接口调整或不可抗力导致的数据丢失，本站不承担赔偿责任。</li>
              <li><strong>安全风险：</strong>建议用户在受信任的网络环境中使用。</li>
            </ul>
          </section>
        </div>

        {/* Footer Button */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

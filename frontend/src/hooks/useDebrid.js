import { useSettingsContext } from "../context/SettingsContext.jsx";
import { API_URL } from "../services/api.js";

export function useDebrid() {
  const {
    debridService,
    setDebridService,
    rdUnlocked,
    setRdUnlocked,
    setRdAdminCode,
  } = useSettingsContext();

  async function handleDebridChange(service) {
    if (service === "real-debrid") {
      if (rdUnlocked) {
        setDebridService("real-debrid");
      } else {
        const code = prompt("Enter access code for Real-Debrid:");
        if (!code) return;

        try {
          const res = await fetch(`${API_URL}/verify-rd`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });

          const data = await res.json();

          if (data.success) {
            setRdUnlocked(true);
            setRdAdminCode(code);
            setDebridService("real-debrid");
          } else {
            alert("❌ Only admin can access Real-Debrid");
            setDebridService("torbox");
          }
        } catch (err) {
          console.error(err);
          alert("Error verifying access");
        }
      }
    } else {
      setDebridService(service);
    }
  }

  return {
    debridService,
    handleDebridChange,
    rdUnlocked,
  };
}

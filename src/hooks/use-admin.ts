import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { if (active) setIsAdmin(false); return; }
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (active) setIsAdmin(!!data);
    })();
    return () => { active = false; };
  }, []);
  return isAdmin;
}

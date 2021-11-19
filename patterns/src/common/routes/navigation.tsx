import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Layout from '../components/Layout';
import { routes } from './routes';

function Navigation(): JSX.Element {
  return (
    <Layout>
      <Suspense fallback={null}>
        <Routes>
          {routes.map(({ path, children, component: Component }) => {
            if (children) {
              return (
                <Route key={path} path="/auth" element={<Component />}>
                  {children.map(child => {
                    if (child.isIndex) {
                      return <Route key={child.path} index element={<child.component />} />;
                    } else {
                      return (
                        <Route key={child.path} path={child.path} element={<child.component />} />
                      );
                    }
                  })}
                </Route>
              );
            } else {
              return <Route key={path} path={path} element={<Component />} />;
            }
          })}
          <Route path="*" element={<Navigate to={routes[0].path} replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default Navigation;
